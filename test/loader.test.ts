import {promises as fs} from 'fs';
import * as fse from 'fs-extra';
import * as os from 'os';
import * as path from 'path';

import {expect} from 'chai';
import * as chai from 'chai';
import chaiAsPromised = require('chai-as-promised');
chai.use(chaiAsPromised);

import {ApplicationAssignment} from '../src';
import {loadAll} from '../src/loader';

import schema = require('../schemas/controlplane.json');

describe('loader', () => {
  it('loads definitions', async () => {
    const assignments = await loadAll<ApplicationAssignment>(
      'test/control-plane/assignments'
    );
    expect(assignments.length).to.be.greaterThan(0);
    expect(assignments[0].metadata.name).to.equal('testapp1.dev-cluster1');
  });

  it('loads definitions with schema', async () => {
    const assignments = await loadAll<ApplicationAssignment>(
      'test/control-plane/assignments',
      schema.$defs.ApplicationAssignment
    );
    expect(assignments.length).to.be.greaterThan(0);
    expect(assignments[0].metadata.name).to.equal('testapp1.dev-cluster1');
  });

  it('rejects bad definitions with schema', async () => {
    expect(
      loadAll<ApplicationAssignment>(
        'test/control-plane/assignments',
        schema.$defs.Cluster // validate against a schema that won't pass
      )
    ).to.be.rejected;
  });

  it('skips hidden files', async () => {
    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), '/'));
    await fse.copy('./test/control-plane/assignments', tmpDir);
    await fs.writeFile(path.join(tmpDir, '.gitkeep'), '', 'utf8');

    const assignments = await loadAll<ApplicationAssignment>(
      tmpDir,
      schema.$defs.ApplicationAssignment
    );
    expect(assignments.length).to.be.greaterThan(0);
    expect(assignments[0].metadata.name).to.equal('testapp1.dev-cluster1');
  });
});
