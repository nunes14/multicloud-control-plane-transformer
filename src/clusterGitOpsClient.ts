import {existsSync, promises as fs} from 'fs';
import path = require('path');
import Mustache = require('mustache');

import {ApplicationAssignment, Cluster} from '.';
import simpleGit from 'simple-git';

// We need to render special characters for repo urls, so we disable escaping
Mustache.escape = text => text;

export interface Kustomization {
  apiVersion: string;
  kind: 'Kustomization';
  metadata: {
    name: string;
    annotations?: {
      [k: string]: string;
    };
  };
  resources?: string[];
  spec?: {
    path: string;
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
    // prune clusters not present in the cluster list

    for (const cluster of clusters) {
      const clusterDir = path.join(
        this.localPath,
        'clusters',
        cluster.metadata.name
      );
      await this.resetDir(clusterDir);
      await this.populateClusterDir(clusterDir, cluster);
      await this.populateClusterApplications(clusterDir, assignments);
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

    const templateDir = path.join('templates/cluster');
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
    path: string,
    assignments: ApplicationAssignment[]
  ): Promise<void> {
    // for each application assigned to the cluster
    // add a file that points to the correct location in /applications
    // update kustomization.yaml to include the above file
  }
}
