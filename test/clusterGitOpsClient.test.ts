import {expect} from 'chai';
import {existsSync, promises as fs} from 'fs';
import * as path from 'path';
import * as yaml from 'js-yaml';

import {ApplicationAssignment, Cluster} from '../src';
import {ClusterGitOpsClient, Kustomization} from '../src/clusterGitOpsClient';
import simpleGit from 'simple-git';
import {generateClusterGitopsRepo} from './util';

interface Manifest {
  kind: string;
}

interface GitRepository extends Manifest {
  metadata: {
    name: string;
  };
  spec: {
    url: string;
    ref: {
      branch: string;
    };
  };
}

describe('ClusterGitOpsClient', () => {
  it('can create a client in an empty dir', async () => {
    const tmpDir = await generateClusterGitopsRepo();
    const client = new ClusterGitOpsClient(tmpDir);
    expect(client).to.not.be.null;
  });

  describe('apply', () => {
    it.skip('prunes cluster directories not present in the cluster list', async () => {});

    it('removes extra files present in the cluster directory', async () => {
      const tmpDir = await generateClusterGitopsRepo();
      const clusters: Cluster[] = [
        {
          kind: 'Cluster',
          metadata: {
            name: 'cluster1',
          },
          spec: {},
        },
      ];

      const extraFilePath = path.join(
        tmpDir,
        'clusters',
        'cluster1',
        'flux-system',
        'extra.yaml'
      );
      await fs.mkdir(path.dirname(extraFilePath), {recursive: true});
      await fs.writeFile(extraFilePath, 'extra: app', 'utf8');

      const client = new ClusterGitOpsClient(tmpDir);
      await client.apply(clusters, []);

      expect(existsSync(extraFilePath)).to.equal(false);
    });

    it('creates base cluster files for a cluster with no assigned applications', async () => {
      const tmpDir = await generateClusterGitopsRepo();
      const clusters: Cluster[] = [
        {
          kind: 'Cluster',
          metadata: {
            name: 'cluster1',
          },
          spec: {},
        },
      ];

      const client = new ClusterGitOpsClient(tmpDir);
      await client.apply(clusters, []);

      const expectedPath = path.join(
        tmpDir,
        'clusters',
        'cluster1',
        'flux-system',
        'kustomization.yaml'
      );
      expect(existsSync(expectedPath)).to.equal(true);
    });

    it('creates base cluster files for a cluster with applications', async () => {
      const tmpDir = await generateClusterGitopsRepo();
      const clusters: Cluster[] = [
        {
          kind: 'Cluster',
          metadata: {
            name: 'cluster1',
          },
          spec: {},
        },
      ];
      const assignments: ApplicationAssignment[] = [
        {
          kind: 'ApplicationAssignment',
          metadata: {
            name: 'assignment1',
          },
          spec: {
            cluster: 'cluster1',
            application: 'application1',
          },
        },
      ];

      const client = new ClusterGitOpsClient(tmpDir);
      await client.apply(clusters, assignments);

      const expectedPath = path.join(
        tmpDir,
        'clusters',
        'cluster1',
        'flux-system',
        'kustomization.yaml'
      );
      expect(existsSync(expectedPath)).to.equal(true);
    });

    it('populates repository information inside the base cluster files', async () => {
      const tmpDir = await generateClusterGitopsRepo();

      const clusters: Cluster[] = [
        {
          kind: 'Cluster',
          metadata: {
            name: 'cluster1',
          },
          spec: {},
        },
      ];
      const assignments: ApplicationAssignment[] = [
        {
          kind: 'ApplicationAssignment',
          metadata: {
            name: 'assignment1',
          },
          spec: {
            cluster: 'cluster1',
            application: 'application1',
          },
        },
      ];

      const client = new ClusterGitOpsClient(tmpDir);
      await client.apply(clusters, assignments);

      const expectedPath = path.join(
        tmpDir,
        'clusters',
        'cluster1',
        'flux-system',
        'gotk-sync.yaml'
      );
      const text = await fs.readFile(expectedPath, 'utf8');
      const manifests = yaml.loadAll(text) as Manifest[];
      for (const m of manifests) {
        if (m.kind === 'Kustomization') {
          const kustomization = m as Kustomization;
          expect(kustomization.metadata.name).to.equal('flux-system');
          expect(kustomization.spec?.path).to.equal(
            './clusters/cluster1/flux-system'
          );
        } else if (m.kind === 'GitRepository') {
          const gitRepository = m as GitRepository;
          expect(gitRepository.metadata.name).to.equal('flux-system');
          expect(gitRepository.spec.url).to.equal(
            'ssh://git@github.com/microsoft/multicloud-control-plane-cluster-gitops-seed.git'
          );
          expect(gitRepository.spec.ref.branch).to.equal('main');
        }
      }
    });

    it('keeps an ssh url from a remote', async () => {
      const tmpDir = await generateClusterGitopsRepo();
      const git = simpleGit(tmpDir);
      await git.removeRemote('origin');
      await git.addRemote(
        'origin',
        'ssh://git@github.com/microsoft/multicloud-control-plane-cluster-gitops-seed.git'
      );

      const clusters: Cluster[] = [
        {
          kind: 'Cluster',
          metadata: {
            name: 'cluster1',
          },
          spec: {},
        },
      ];
      const assignments: ApplicationAssignment[] = [
        {
          kind: 'ApplicationAssignment',
          metadata: {
            name: 'assignment1',
          },
          spec: {
            cluster: 'cluster1',
            application: 'application1',
          },
        },
      ];

      const client = new ClusterGitOpsClient(tmpDir);
      await client.apply(clusters, assignments);

      const expectedPath = path.join(
        tmpDir,
        'clusters',
        'cluster1',
        'flux-system',
        'gotk-sync.yaml'
      );
      const text = await fs.readFile(expectedPath, 'utf8');
      const manifests = yaml.loadAll(text) as Manifest[];
      for (const m of manifests) {
        if (m.kind === 'Kustomization') {
          const kustomization = m as Kustomization;
          expect(kustomization.metadata.name).to.equal('flux-system');
          expect(kustomization.spec?.path).to.equal(
            './clusters/cluster1/flux-system'
          );
        } else if (m.kind === 'GitRepository') {
          const gitRepository = m as GitRepository;
          expect(gitRepository.metadata.name).to.equal('flux-system');
          expect(gitRepository.spec.url).to.equal(
            'ssh://git@github.com/microsoft/multicloud-control-plane-cluster-gitops-seed.git'
          );
          expect(gitRepository.spec.ref.branch).to.equal('main');
        }
      }
    });

    it.skip('creates application files for a cluster with applications', async () => {
      const tmpDir = await generateClusterGitopsRepo();
      const clusters: Cluster[] = [
        {
          kind: 'Cluster',
          metadata: {
            name: 'cluster1',
          },
          spec: {},
        },
      ];
      const assignments: ApplicationAssignment[] = [
        {
          kind: 'ApplicationAssignment',
          metadata: {
            name: 'assignment1',
          },
          spec: {
            cluster: 'cluster1',
            application: 'application1',
          },
        },
      ];

      const client = new ClusterGitOpsClient(tmpDir);
      await client.apply(clusters, assignments);

      const expectedPath = path.join(
        tmpDir,
        'clusters',
        'cluster1',
        'flux-system',
        'app-cluster1.yaml'
      );
      const kustomizationText = await fs.readFile(expectedPath, 'utf8');
      const kustomization = yaml.load(kustomizationText) as Kustomization;
      expect(kustomization.metadata.name).to.equal('application1');
      expect(kustomization.spec?.path).to.equal('./applications/application1');
    });

    it.skip('updates kustomization.yaml for a cluster with applications', async () => {
      const tmpDir = await generateClusterGitopsRepo();
      const clusters: Cluster[] = [
        {
          kind: 'Cluster',
          metadata: {
            name: 'cluster1',
          },
          spec: {},
        },
      ];
      const assignments: ApplicationAssignment[] = [
        {
          kind: 'ApplicationAssignment',
          metadata: {
            name: 'assignment1',
          },
          spec: {
            cluster: 'cluster1',
            application: 'application1',
          },
        },
      ];

      const client = new ClusterGitOpsClient(tmpDir);
      await client.apply(clusters, assignments);

      const expectedPath = path.join(
        tmpDir,
        'clusters',
        'cluster1',
        'flux-system',
        'kustomization.yaml'
      );
      const kustomizationText = await fs.readFile(expectedPath, 'utf8');
      const kustomization = yaml.load(kustomizationText) as Kustomization;
      expect(kustomization.resources).to.include('app-cluster1.yaml');
    });
  });
});
