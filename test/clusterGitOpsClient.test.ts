import {expect} from 'chai';
import {existsSync, promises as fs} from 'fs';
import * as path from 'path';
import * as yaml from 'js-yaml';

import {ApplicationAssignment, Cluster} from '../src';
import {
  ClusterGitOpsClient,
  ResourcesKustomization,
  Kustomization,
} from '../src/clusterGitOpsClient';
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

    it('creates application files for a cluster with applications', async () => {
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
        'assignment1.yaml'
      );
      const kustomizationText = await fs.readFile(expectedPath, 'utf8');
      const kustomization = yaml.load(kustomizationText) as Kustomization;
      expect(kustomization.metadata.name).to.equal('assignment1');
      expect(kustomization.spec?.path).to.equal('./applications/application1');
    });

    it('creates application files for multiple clusters with applications', async () => {
      const tmpDir = await generateClusterGitopsRepo();
      const clusters: Cluster[] = [
        {
          kind: 'Cluster',
          metadata: {
            name: 'cluster1',
          },
          spec: {},
        },
        {
          kind: 'Cluster',
          metadata: {
            name: 'cluster2',
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
        {
          kind: 'ApplicationAssignment',
          metadata: {
            name: 'assignment2',
          },
          spec: {
            cluster: 'cluster1',
            application: 'application2',
          },
        },
        {
          kind: 'ApplicationAssignment',
          metadata: {
            name: 'assignment3',
          },
          spec: {
            cluster: 'cluster2',
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
        'assignment1.yaml'
      );
      const kustomizationText = await fs.readFile(expectedPath, 'utf8');
      const kustomization = yaml.load(kustomizationText) as Kustomization;
      expect(kustomization.metadata.name).to.equal('assignment1');
      expect(kustomization.spec?.path).to.equal('./applications/application1');

      const expectedPath2 = path.join(
        tmpDir,
        'clusters',
        'cluster2',
        'flux-system',
        'assignment3.yaml'
      );
      const kustomizationText2 = await fs.readFile(expectedPath2, 'utf8');
      const kustomization2 = yaml.load(kustomizationText2) as Kustomization;
      expect(kustomization2.metadata.name).to.equal('assignment3');
      expect(kustomization2.spec?.path).to.equal('./applications/application1');
    });

    it('updates kustomization.yaml for a cluster with applications', async () => {
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
      const kustomization = yaml.load(
        kustomizationText
      ) as ResourcesKustomization;
      expect(kustomization.resources).to.include('assignment1.yaml');
    });
  });
});
