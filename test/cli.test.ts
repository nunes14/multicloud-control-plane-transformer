import {expect} from 'chai';
import {promises as fs} from 'fs';
import * as fse from 'fs-extra';
import * as os from 'os';
import * as path from 'path';
import simpleGit from 'simple-git';

import {program} from '../src/cli';
import {ControlPlaneClient} from '../src/controlPlaneClient';
import {cloneWithSparseCheckout} from '../src/git';
import {generateClusterGitopsRepo} from './util';

describe('cli', () => {
  describe('assign', () => {
    it('runs on the test data', async () => {
      await program.parseAsync(['assign', './test/control-plane'], {
        from: 'user',
      });
    });

    it('can create an assignment', async () => {
      const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), '/'));
      await fse.copy('./test/control-plane', tmpDir);

      const client = new ControlPlaneClient(tmpDir);
      await client.addCluster({
        kind: 'Cluster',
        metadata: {
          name: 'cluster2',
          labels: {
            geo: 'US',
          },
        },
        spec: {
          environments: ['dev'],
        },
      });

      await program.parseAsync(['assign', tmpDir], {
        from: 'user',
      });

      const expectedPath = path.join(
        tmpDir,
        'assignments',
        'testapp1.dev-cluster2.yaml'
      );
      const stats = await fs.stat(expectedPath);
      expect(stats.isFile()).to.equal(true);
    });

    it('can delete an assignment', async () => {
      const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), '/'));
      await fse.copy('./test/control-plane', tmpDir);

      const client = new ControlPlaneClient(tmpDir);
      await client.addAssignment({
        kind: 'ApplicationAssignment',
        metadata: {
          name: 'some-random-name',
        },
        spec: {
          application: 'testapp1',
          cluster: 'cluster99999',
        },
      });
      const expectedPath = path.join(
        tmpDir,
        'assignments',
        'some-random-name.yaml'
      );
      const stats = await fs.stat(expectedPath);
      expect(stats.isFile()).to.equal(true);

      await program.parseAsync(['assign', tmpDir], {
        from: 'user',
      });

      expect(async () => {
        await fs.stat(expectedPath);
      }).to.throw;
    });
  });

  describe('render', function () {
    this.timeout(5000);

    it('can render a template', async () => {
      const tmpControlPlaneDir = await cloneControlPlaneRepo();
      const tmpGitopsDir = await generateClusterGitopsRepo();

      await program.parseAsync(['render', tmpControlPlaneDir, tmpGitopsDir], {
        from: 'user',
      });

      const deploymentPath = path.join(
        tmpGitopsDir,
        'applications',
        'testapp1.dev',
        'deployment.yaml'
      );
      const stats = await fs.stat(deploymentPath);
      expect(stats.isFile()).to.equal(true);
    });
  });

  describe('apply', () => {
    it('can apply cluster information', async () => {
      const tmpControlPlaneDir = await cloneControlPlaneRepo();
      const tmpGitopsDir = await generateClusterGitopsRepo();

      await program.parseAsync(['apply', tmpControlPlaneDir, tmpGitopsDir], {
        from: 'user',
      });

      const deploymentPath = path.join(
        tmpGitopsDir,
        'clusters',
        'cluster1',
        'flux-system',
        'kustomization.yaml'
      );
      const stats = await fs.stat(deploymentPath);
      expect(stats.isFile()).to.equal(true);
    });
  });
});

/** Make a copy of the test control plane data */
async function cloneControlPlaneRepo(): Promise<string> {
  const git = simpleGit(process.cwd());
  const branches = await git.branch();

  const tmpDataDir = await cloneWithSparseCheckout(
    process.cwd(),
    ['test/control-plane/**/*'],
    branches.current
  );

  // replace the repo references with the latest commit from the current directory
  const tmpControlPlaneDir = path.join(tmpDataDir, 'test/control-plane');
  const client = new ControlPlaneClient(tmpControlPlaneDir);
  for (const application of await client.getApplications()) {
    application.spec.repo = process.cwd();
    application.spec.ref = 'HEAD';
    await client.addApplication(application);
  }
  for (const template of await client.getTemplates()) {
    template.spec.repo = process.cwd();
    template.spec.ref = 'HEAD';
    await client.addTemplate(template);
  }
  return tmpControlPlaneDir;
}
