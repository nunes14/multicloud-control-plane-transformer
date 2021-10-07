import {expect} from 'chai';
import {promises as fs} from 'fs';
import * as os from 'os';
import * as path from 'path';

import {ClusterGitOpsClient} from '../src/clusterGitOpsClient';

describe('ControlPlaneClient', () => {
  it('can create a client in an empty dir', async () => {
    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), '/'));
    const client = new ClusterGitOpsClient(tmpDir);
    expect(client).to.not.be.null;
  });

  describe('apply', () => {
    it.skip('prunes cluster directories not present in the cluster list', () => {});
    it.skip('removes extra files present in the cluster directory', () => {});
    it.skip('creates base cluster files for a cluster with no assigned applications', () => {});
    it.skip('creates base cluster files for a cluster with applications', () => {});
    it.skip('populates repository information inside the base cluster files', () => {});
    it.skip('creates application files for a cluster with applications', () => {});
    it.skip('updates kustomization.yaml for a cluster with applications', () => {});
  });
});
