import {promises as fs} from 'fs';
import * as path from 'path';

import {
  Application,
  ApplicationDeployment,
  ApplicationAssignment,
  Cluster,
  ApplicationTemplate,
  Template,
} from '../src';
import {loadAll} from '../src/loader';

import applicationSchema = require('../schemas/application.json');
import controlPlaneSchema = require('../schemas/controlplane.json');
import templateSchema = require('../schemas/template.json');

describe('schemas', () => {
  it('has well-formed application test data', async () => {
    await loadAll<Application>('test/applications/testapp1', applicationSchema);
  });

  it('has well-formed control plane test data', async () => {
    await loadAll<ApplicationDeployment>(
      'test/control-plane/applications',
      controlPlaneSchema.$defs.ApplicationDeployment
    );
    await loadAll<ApplicationAssignment>(
      'test/control-plane/assignments',
      controlPlaneSchema.$defs.ApplicationAssignment
    );
    await loadAll<Cluster>(
      'test/control-plane/clusters',
      controlPlaneSchema.$defs.Cluster
    );
    await loadAll<ApplicationTemplate>(
      'test/control-plane/templates',
      controlPlaneSchema.$defs.ApplicationTemplate
    );
  });

  it('has well-formed template test data', async () => {
    for (const templateDir of await fs.readdir('test/templates')) {
      const absPath = path.join('test/templates', templateDir);
      await loadAll<Template>(absPath, templateSchema);
    }
  });
});
