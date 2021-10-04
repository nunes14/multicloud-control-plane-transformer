import {expect} from 'chai';
import * as fs from 'fs';
import path = require('path');
import simpleGit from 'simple-git';
import {
  addPatternsToSparseCheckout,
  checkout,
  cloneWithSparseCheckout,
} from '../src/git';

describe('git', function () {
  // Extend timeout to 5s since these tests invoke git commands
  this.timeout(5000);

  it('performs a clone with sparse checkout with one file', async () => {
    const cloneDir = await cloneWithSparseCheckout(
      'https://github.com/microsoft/multicloud-control-plane-transformer',
      ['LICENSE']
    );

    const licensePath = path.join(cloneDir, 'LICENSE');
    const licenseExists = fs.existsSync(licensePath);
    expect(licenseExists).to.equal(true);
  });

  it('performs a clone with sparse checkout with multiple files', async () => {
    const cloneDir = await cloneWithSparseCheckout(
      'https://github.com/microsoft/multicloud-control-plane-transformer',
      ['LICENSE', 'README.md']
    );

    const licensePath = path.join(cloneDir, 'LICENSE');
    const licenseExists = fs.existsSync(licensePath);
    expect(licenseExists).to.equal(true);

    const readmePath = path.join(cloneDir, 'README.md');
    const readmeExists = fs.existsSync(readmePath);
    expect(readmeExists).to.equal(true);
  });

  it('adds files to an existing sparse checkout', async () => {
    const cloneDir = await cloneWithSparseCheckout(
      'https://github.com/microsoft/multicloud-control-plane-transformer',
      ['LICENSE']
    );

    await addPatternsToSparseCheckout(['README.md'], cloneDir);
    await checkout(cloneDir);

    const readmePath = path.join(cloneDir, 'README.md');
    const readmeExists = fs.existsSync(readmePath);
    expect(readmeExists).to.equal(true);
  });

  it('does not download additional files', async () => {
    const cloneDir = await cloneWithSparseCheckout(
      'https://github.com/microsoft/multicloud-control-plane-transformer',
      ['LICENSE']
    );

    const files = fs.readdirSync(cloneDir).filter(f => f !== '.git');
    expect(files.length).to.equal(1);
  });

  it('does not download a full commit history', async () => {
    const cloneDir = await cloneWithSparseCheckout(
      'https://github.com/microsoft/multicloud-control-plane-transformer',
      ['LICENSE']
    );

    const git = simpleGit(cloneDir);
    const log = await git.log();
    expect(log.total).to.equal(1);
  });
});
