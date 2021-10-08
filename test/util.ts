import {promises as fs} from 'fs';
import * as os from 'os';
import * as path from 'path';
import simpleGit from 'simple-git';

export async function generateClusterGitopsRepo(): Promise<string> {
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), '/'));
  const git = simpleGit(tmpDir);
  await git.init();
  await git.addRemote(
    'origin',
    'https://github.com/microsoft/multicloud-control-plane-cluster-gitops-seed'
  );
  return tmpDir;
}
