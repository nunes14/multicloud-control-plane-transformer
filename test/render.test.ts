import {expect} from 'chai';
import {existsSync, promises as fs} from 'fs';
import * as os from 'os';
import * as path from 'path';
import * as process from 'process';

import {
  ApplicationDeploymentDuplicateError,
  ApplicationTemplateNotFoundError,
  generateValues,
  MissingParametersError,
  renderAll,
} from '../src/render';
import {
  Application,
  ApplicationDeployment,
  ApplicationTemplate,
  Template,
} from '../src';

describe('render', () => {
  it('renders files into the output dir', async () => {
    const deployments: ApplicationDeployment[] = [
      {
        kind: 'ApplicationDeployment',
        metadata: {
          name: 'testapp1.dev',
        },
        spec: {
          repo: process.cwd(),
          ref: 'HEAD',
          path: 'test/applications/testapp1/app.dev.yaml',
          clusters: 1,
          values: {
            overrides: {
              memory: '2G',
            },
          },
        },
      },
    ];

    const templates: ApplicationTemplate[] = [
      {
        kind: 'ApplicationTemplate',
        metadata: {
          name: 'external-service',
        },
        spec: {
          repo: process.cwd(),
          ref: 'HEAD',
          path: 'test/templates/external-service/template.yaml',
        },
      },
    ];

    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), '/'));
    await renderAll(deployments, templates, tmpDir);

    const manifests = await fs.readdir(
      'test/templates/external-service/deploy'
    );
    for (const fileName of manifests) {
      const actualPath = path.join(
        tmpDir,
        'applications',
        'testapp1.dev',
        fileName
      );
      const actual = await fs.readFile(actualPath, 'utf8');

      const expectedOutputPath = path.join(
        'test',
        'expectedOutputs',
        'applications',
        'testapp1.dev',
        fileName
      );
      const expected = await fs.readFile(expectedOutputPath, 'utf8');

      // Mustache strips final newlines so it's not a 100% correct conversion, but we don't care
      expect(expected.trimEnd()).to.equal(actual.trimEnd());
    }
  });

  it('throws for a template that does not exist', async () => {
    const deployments: ApplicationDeployment[] = [
      {
        kind: 'ApplicationDeployment',
        metadata: {
          name: 'testapp1.dev',
        },
        spec: {
          repo: process.cwd(),
          ref: 'HEAD',
          path: 'test/applications/testapp1/app.dev.yaml',
          clusters: 1,
        },
      },
    ];

    const templates: ApplicationTemplate[] = [];

    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), '/'));
    expect(renderAll(deployments, templates, tmpDir)).to.be.rejectedWith(
      ApplicationTemplateNotFoundError
    );
  });

  it('clears old applications from the output directory', async () => {
    const deployments: ApplicationDeployment[] = [
      {
        kind: 'ApplicationDeployment',
        metadata: {
          name: 'testapp1.dev',
        },
        spec: {
          repo: process.cwd(),
          ref: 'HEAD',
          path: 'test/applications/testapp1/app.dev.yaml',
          clusters: 1,
          values: {
            overrides: {
              memory: '2G',
            },
          },
        },
      },
    ];

    const templates: ApplicationTemplate[] = [
      {
        kind: 'ApplicationTemplate',
        metadata: {
          name: 'external-service',
        },
        spec: {
          repo: process.cwd(),
          ref: 'HEAD',
          path: 'test/templates/external-service/template.yaml',
        },
      },
    ];

    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), '/'));

    const renderPath = path.join(tmpDir, 'applications', 'oldapplication');
    await fs.mkdir(renderPath, {recursive: true});

    const extraFilePath = path.join(renderPath, 'extra.txt');
    await fs.writeFile(extraFilePath, 'extra file', 'utf8');

    await renderAll(deployments, templates, tmpDir);

    expect(existsSync(extraFilePath)).to.equal(false);
  });

  it('throws an error if an application deployment name is not unique', async () => {
    const deployments: ApplicationDeployment[] = [
      {
        kind: 'ApplicationDeployment',
        metadata: {
          name: 'testapp1.dev',
        },
        spec: {
          repo: process.cwd(),
          ref: 'HEAD',
          path: 'test/applications/testapp1/app.dev.yaml',
          clusters: 1,
          values: {
            overrides: {
              memory: '2G',
            },
          },
        },
      },
      {
        kind: 'ApplicationDeployment',
        metadata: {
          name: 'testapp1.dev',
        },
        spec: {
          repo: process.cwd(),
          ref: 'HEAD',
          path: 'test/applications/testapp1/app.dev.yaml',
          clusters: 1,
          values: {
            overrides: {
              memory: '2G',
            },
          },
        },
      },
    ];

    const templates: ApplicationTemplate[] = [
      {
        kind: 'ApplicationTemplate',
        metadata: {
          name: 'external-service',
        },
        spec: {
          repo: process.cwd(),
          ref: 'HEAD',
          path: 'test/templates/external-service/template.yaml',
        },
      },
    ];

    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), '/'));

    await expect(renderAll(deployments, templates, tmpDir)).to.be.rejectedWith(ApplicationDeploymentDuplicateError);
  });

  describe('values', () => {
    it('uses template default values', () => {
      const template: Template = {
        manifests: 'demo',
        parameters: {
          param1: {
            default: 'hello',
          },
        },
      };

      const app: Application = {
        template: 'test',
        values: {},
      };

      const deployment: ApplicationDeployment = {
        kind: 'ApplicationDeployment',
        metadata: {
          name: 'deploy1',
        },
        spec: {
          clusters: 1,
          repo: 'testRepo',
          ref: 'main',
          path: 'app.yaml',
        },
      };

      const values = generateValues(template, app, deployment);
      expect(values['param1']).to.equal('hello');
    });

    it('uses app values', () => {
      const template: Template = {
        manifests: 'demo',
        parameters: {
          param1: {},
        },
      };

      const app: Application = {
        template: 'test',
        values: {
          param1: 'world',
        },
      };

      const deployment: ApplicationDeployment = {
        kind: 'ApplicationDeployment',
        metadata: {
          name: 'deploy1',
        },
        spec: {
          clusters: 1,
          repo: 'testRepo',
          ref: 'main',
          path: 'app.yaml',
        },
      };

      const values = generateValues(template, app, deployment);
      expect(values['param1']).to.equal('world');
    });

    it('uses app values over template default values', () => {
      const template: Template = {
        manifests: 'demo',
        parameters: {
          param1: {
            default: 'hello',
          },
        },
      };

      const app: Application = {
        template: 'test',
        values: {
          param1: 'world',
        },
      };

      const deployment: ApplicationDeployment = {
        kind: 'ApplicationDeployment',
        metadata: {
          name: 'deploy1',
        },
        spec: {
          clusters: 1,
          repo: 'testRepo',
          ref: 'main',
          path: 'app.yaml',
        },
      };

      const values = generateValues(template, app, deployment);
      expect(values['param1']).to.equal('world');
    });

    it('uses deployment values', () => {
      const template: Template = {
        manifests: 'demo',
        parameters: {
          param1: {},
        },
      };

      const app: Application = {
        template: 'test',
        values: {},
      };

      const deployment: ApplicationDeployment = {
        kind: 'ApplicationDeployment',
        metadata: {
          name: 'deploy1',
        },
        spec: {
          clusters: 1,
          repo: 'testRepo',
          ref: 'main',
          path: 'app.yaml',
          values: {
            overrides: {
              param1: 'platform',
            },
          },
        },
      };

      const values = generateValues(template, app, deployment);
      expect(values['param1']).to.equal('platform');
    });

    it('uses deployment values over template defaults', () => {
      const template: Template = {
        manifests: 'demo',
        parameters: {
          param1: {
            default: 'hello',
          },
        },
      };

      const app: Application = {
        template: 'test',
        values: {},
      };

      const deployment: ApplicationDeployment = {
        kind: 'ApplicationDeployment',
        metadata: {
          name: 'deploy1',
        },
        spec: {
          clusters: 1,
          repo: 'testRepo',
          ref: 'main',
          path: 'app.yaml',
          values: {
            overrides: {
              param1: 'platform',
            },
          },
        },
      };

      const values = generateValues(template, app, deployment);
      expect(values['param1']).to.equal('platform');
    });

    it('uses deployment values over app values', () => {
      const template: Template = {
        manifests: 'demo',
        parameters: {
          param1: {
            default: 'hello',
          },
        },
      };

      const app: Application = {
        template: 'test',
        values: {
          param1: 'world',
        },
      };

      const deployment: ApplicationDeployment = {
        kind: 'ApplicationDeployment',
        metadata: {
          name: 'deploy1',
        },
        spec: {
          clusters: 1,
          repo: 'testRepo',
          ref: 'main',
          path: 'app.yaml',
          values: {
            overrides: {
              param1: 'platform',
            },
          },
        },
      };

      const values = generateValues(template, app, deployment);
      expect(values['param1']).to.equal('platform');
    });

    it('throws when parameters have not been specified', () => {
      const template: Template = {
        manifests: 'demo',
        parameters: {
          param1: {},
        },
      };

      const app: Application = {
        template: 'test',
        values: {},
      };

      const deployment: ApplicationDeployment = {
        kind: 'ApplicationDeployment',
        metadata: {
          name: 'deploy1',
        },
        spec: {
          clusters: 1,
          repo: 'testRepo',
          ref: 'main',
          path: 'app.yaml',
        },
      };

      expect(() => generateValues(template, app, deployment)).to.throw(
        MissingParametersError
      );
    });
  });
});
