import {existsSync, promises as fs} from 'fs';
import path = require('path');
import Mustache = require('mustache');
import * as yaml from 'js-yaml';

import {ApplicationAssignment, Cluster} from '.';
import simpleGit from 'simple-git';

// We need to render special characters for repo urls, so we disable escaping
Mustache.escape = text => text;

export interface ResourcesKustomization {
  apiVersion: string;
  kind: 'Kustomization';
  resources: string[];
}

export interface Kustomization {
  apiVersion: string;
  kind: 'Kustomization';
  metadata: {
    name: string;
    namespace?: string;
    annotations?: {
      [k: string]: string;
    };
  };
  spec: {
    interval: string;
    sourceRef: {
      kind: string;
      name: string;
    };
    path: string;
    prune: boolean;
  };
}

/** A client for interacting with the contents of the cluster gitops repository */
export class ClusterGitOpsClient {
  private localPath: string;

  constructor(localPath: string) {
    this.localPath = localPath;
  }

  /** overwrite contents of the cluster gitops repo to match the specified clusters and assignments */
  async apply(clusters: Cluster[], assignments: ApplicationAssignment[]) {
    // prune cluster directories for clusters not present in the cluster list
    await this.pruneObsoleteClusterDirs(clusters);

    // populate files per cluster
    const assignmentsMap = this.getClusterAssignmentsMap(assignments);
    for (const cluster of clusters) {
      const clusterDir = path.join(
        this.localPath,
        'clusters',
        cluster.metadata.name
      );

      // reset the folder and start from scratch every time to ensure old files are removed
      await this.resetDir(clusterDir);

      // add the base files that every cluster gets
      await this.populateClusterDir(clusterDir, cluster);

      // add application assignment files
      const clusterAssignments = assignmentsMap.get(cluster.metadata.name);
      if (clusterAssignments) {
        await this.populateClusterApplications(clusterDir, clusterAssignments);
      }
    }
  }

  /** check content of the cluster gitops repo for obsolete cluster folders and prune ones */
  async pruneObsoleteClusterDirs(clusters: Cluster[]) {
    const clusterSet = new Set<string>(clusters.map(c => c.metadata.name));
    const clustersDir = path.join(this.localPath, 'clusters');
    const existingDirs = await fs.readdir(clustersDir);
    for (const dir of existingDirs) {
      const stats = await fs.stat(path.join(clustersDir, dir));
      if (
        stats.isDirectory() === true &&
        !clusterSet.has(dir) &&
        dir !== 'base'
      ) {
        await fs.rm(path.join(clustersDir, dir), {recursive: true});
      }
    }
  }

  async resetDir(path: string): Promise<void> {
    if (existsSync(path)) {
      await fs.rm(path, {recursive: true});
    }
    await fs.mkdir(path, {recursive: true});
  }

  /** populate the target directory with the base cluster files, with placeholders filled in */
  async populateClusterDir(
    clusterDir: string,
    cluster: Cluster
  ): Promise<void> {
    const fluxSystemDir = path.join(clusterDir, 'flux-system');
    await fs.mkdir(fluxSystemDir, {recursive: true});

    const packageDir = require.resolve('.');
    const templateDir = path.join(packageDir, '../../templates/cluster');
    for (const file of await fs.readdir(templateDir)) {
      const template = await fs.readFile(path.join(templateDir, file), 'utf8');

      const values = {
        clusterName: cluster.metadata.name,
        clusterGitOpsRepo: await this.getFluxRepoUrl(),
      };

      const renderedTemplate = Mustache.render(template, values);
      const outputPath = path.join(fluxSystemDir, file);
      await fs.writeFile(outputPath, renderedTemplate, 'utf8');
    }
  }

  /** get a url to be used in a Flux GitRepository resource */
  async getFluxRepoUrl() {
    // use the current origin remote for the url
    const git = simpleGit(this.localPath);
    const remotes = await git.getRemotes(true);
    const fetchUrl = remotes.filter(r => r.name === 'origin')[0].refs.fetch;

    // replace an HTTPS url with its SSH equivalent if necessary
    const match = fetchUrl.match(/https:\/\/(.*)/);
    return match ? `ssh://git@${match[1]}.git` : fetchUrl;
  }

  async populateClusterApplications(
    clusterDir: string,
    assignments: ApplicationAssignment[]
  ): Promise<void> {
    const fluxSystemDir = path.join(clusterDir, 'flux-system');
    await this.createAssignmentKustomizations(fluxSystemDir, assignments);

    const kustomizationPath = path.join(fluxSystemDir, 'kustomization.yaml');
    await this.addAssignmentsToClusterKustomization(
      kustomizationPath,
      assignments
    );
  }

  async createAssignmentKustomizations(
    outputDir: string,
    assignments: ApplicationAssignment[]
  ) {
    for (const assignment of assignments) {
      const kustomization: Kustomization = {
        apiVersion: 'kustomize.toolkit.fluxcd.io/v1beta1',
        kind: 'Kustomization',
        metadata: {
          name: assignment.metadata.name,
          namespace: 'flux-system',
        },
        spec: {
          interval: '1m0s',
          sourceRef: {
            kind: 'GitRepository',
            name: 'flux-system',
          },
          path: `./applications/${assignment.spec.application}`,
          prune: true,
        },
      };
      const kustomizationPath = path.join(
        outputDir,
        `${assignment.metadata.name}.yaml`
      );
      await fs.writeFile(kustomizationPath, yaml.dump(kustomization), 'utf8');
    }
  }

  getClusterAssignmentsMap(assignments: ApplicationAssignment[]) {
    const map = new Map<string, ApplicationAssignment[]>();
    for (const assignment of assignments) {
      if (!map.has(assignment.spec.cluster)) {
        map.set(assignment.spec.cluster, []);
      }
      map.get(assignment.spec.cluster)!.push(assignment);
    }
    return map;
  }

  async addAssignmentsToClusterKustomization(
    kustomizationPath: string,
    assignments: ApplicationAssignment[]
  ) {
    const kustomizationText = await fs.readFile(kustomizationPath, 'utf8');
    const kustomization = yaml.load(
      kustomizationText
    ) as ResourcesKustomization;
    kustomization.resources!.push(
      ...assignments.map(a => `${a.metadata.name}.yaml`)
    );
    await fs.writeFile(kustomizationPath, yaml.dump(kustomization), 'utf8');
  }
}
