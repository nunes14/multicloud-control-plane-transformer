import {promises as fs} from 'fs';
import * as os from 'os';
import * as path from 'path';

import simpleGit from 'simple-git';

export async function cloneWithSparseCheckout(
  repo: string,
  patterns: string[],
  cloneDir?: string,
  ref = 'main'
): Promise<string> {
  cloneDir = cloneDir || (await fs.mkdtemp(path.join(os.tmpdir(), '/')));

  const git = simpleGit(cloneDir);
  await git
    .init()
    .raw('sparse-checkout', 'init')
    .raw('sparse-checkout', 'set', patterns[0]);
  if (patterns.length > 1) {
    await addPatternsToSparseCheckout(patterns.slice(1), cloneDir);
  }
  await git.addRemote('origin', repo);
  await checkout(cloneDir, ref);

  return cloneDir;
}

export async function addPatternsToSparseCheckout(
  patterns: string[],
  cloneDir: string
) {
  const git = simpleGit(cloneDir);
  const additions = patterns.map(f => git.raw('sparse-checkout', 'add', f));
  await Promise.all(additions);
}

export async function checkout(cloneDir: string, ref = 'main') {
  const git = simpleGit(cloneDir);
  await git
    .raw('fetch', 'origin', ref, '--depth', '1')
    .raw('checkout', 'FETCH_HEAD');
}
