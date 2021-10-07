import {expect} from 'chai';
import {promises as fs} from 'fs';
import * as fse from 'fs-extra';
import * as os from 'os';
import * as path from 'path';
import * as yaml from 'js-yaml';

import {ApplicationAssignment} from '../src';
import {ControlPlaneClient} from '../src/controlPlaneClient';

describe('ControlPlaneClient', () => {
  it('can create a client in an empty dir', async () => {
    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), '/'));
    const client = new ControlPlaneClient(tmpDir);
    expect(client).to.not.be.null;
  });

  it('can create a client in a populated dir', async () => {
    const client = new ControlPlaneClient('./test/control-plane');
    expect(client).to.not.be.null;
  });

  it('can read applications', async () => {
    const client = new ControlPlaneClient('./test/control-plane');
    const applications = await client.getApplications();
    expect(applications.length).to.be.greaterThan(0);
  });

  it('can read clusters', async () => {
    const client = new ControlPlaneClient('./test/control-plane');
    const clusters = await client.getClusters();
    expect(clusters.length).to.be.greaterThan(0);
  });

  it('can read assignments', async () => {
    const client = new ControlPlaneClient('./test/control-plane');
    const assignments = await client.getAssignments();
    expect(assignments.length).to.be.greaterThan(0);
  });

  it('can write assignments', async () => {
    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), '/'));
    await fse.copy('./test/control-plane', tmpDir);
    const client = new ControlPlaneClient(tmpDir);

    const assignment: ApplicationAssignment = {
      kind: 'ApplicationAssignment',
      metadata: {
        name: 'test-assignment',
      },
      spec: {
        application: 'app1',
        cluster: 'cluster1',
      },
    };
    await client.addAssignment(assignment);

    const expectedPath = path.join(
      tmpDir,
      'assignments',
      'test-assignment.yaml'
    );
    const text = await fs.readFile(expectedPath, 'utf8');
    const result = yaml.load(text);
    expect(result).to.deep.equal(assignment);
  });

  it('can delete assignments', async () => {
    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), '/'));
    await fse.copy('./test/control-plane', tmpDir);
    const client = new ControlPlaneClient(tmpDir);

    await client.deleteAssignment('assignment1');

    const expectedPath = path.join(tmpDir, 'assignments', 'assignment1.yaml');
    expect(async () => {
      await fs.stat(expectedPath);
    }).to.throw;
  });

  it('can read templates', async () => {
    const client = new ControlPlaneClient('./test/control-plane');
    const templates = await client.getTemplates();
    expect(templates.length).to.be.greaterThan(0);
  });
});
