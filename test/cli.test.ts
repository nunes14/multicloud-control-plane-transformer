import {expect} from 'chai';
import {promises as fs} from 'fs';
import * as fse from 'fs-extra';
import * as os from 'os';
import * as path from 'path';

import {program} from '../src/cli';
import {ControlPlaneClient} from '../src/controlPlaneClient';

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
        'testapp1-cluster2.yaml'
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
});
