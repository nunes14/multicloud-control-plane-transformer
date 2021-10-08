import {
  ApplicationTemplate,
  Application,
  Template,
  ApplicationDeployment,
} from './index';
import {load} from './loader';
import {
  addPatternsToSparseCheckout,
  checkout,
  cloneWithSparseCheckout,
} from './git';
import applicationSchema = require('../schemas/application.json');
import templateSchema = require('../schemas/template.json');
import * as path from 'path';
import Mustache = require('mustache');
import {promises as fs} from 'fs';
import {existsSync} from 'fs';
import {ClusterGitOpsClient} from './clusterGitOpsClient';

export class ApplicationTemplateNotFoundError extends Error {
  constructor(application: string, template: string) {
    super(
      `Cannot ApplicationTemplate ${template} for ApplicationDeployment ${application}`
    );
  }
}

export class ApplicationDeploymentDuplicateError extends Error {
  constructor(appDeploymentName: string) {
    super(
      `There are multiple ApplicationDeployments with the name ${appDeploymentName}`
    );
  }
}

export class MissingParametersError extends Error {
  constructor(template: string, parameters: string[]) {
    super(
      `Cannot generate values for template ${template}. Missing parameters: ${parameters}`
    );
  }
}

export async function renderAll(
  applicationDeployments: ApplicationDeployment[],
  templates: ApplicationTemplate[],
  outputPath: string
) {
  // clear the output directory to ensure that the gitops repo doesn't keep any applications that have been removed
  const gitops = new ClusterGitOpsClient(outputPath);
  await gitops.resetDir(path.join(outputPath, 'applications'));

  const templateMap = new Map<string, ApplicationTemplate>(
    templates.map(t => [t.metadata.name, t])
  );

  const renderTasks = applicationDeployments.map(d =>
    render(d, templateMap, outputPath)
  );
  await Promise.all(renderTasks);
}

async function render(
  deployment: ApplicationDeployment,
  templateMap: Map<string, ApplicationTemplate>,
  outputPath: string
) {
  // dereference the app.yaml from the ApplicationDeployment
  const app = await dereferenceApplication(deployment);

  // get the template associated with the deployment
  const appTemplate = templateMap.get(app.template);
  if (!appTemplate) {
    throw new ApplicationTemplateNotFoundError(
      deployment.metadata.name,
      app.template
    );
  }

  // dereference the template.yaml
  const templateDir = await cloneWithSparseCheckout(
    appTemplate.spec.repo,
    [appTemplate.spec.path],
    appTemplate.spec.ref
  );
  const templatePath = path.join(templateDir, appTemplate.spec.path);
  const template = await load<Template>(templatePath, templateSchema);

  // dereference the associated manifests
  const relativeManifestDir = path.join(
    path.dirname(appTemplate.spec.path),
    template.manifests
  );
  await addPatternsToSparseCheckout([relativeManifestDir], templateDir);
  await checkout(templateDir, appTemplate.spec.ref);

  // build the values that will be used to populate the manifest templates
  const values = generateValues(template, app, deployment);

  // check if there are application deployments with a duplicate name
  const outputDir = path.join(
    outputPath,
    'applications',
    deployment.metadata.name
  );
  if (existsSync(outputDir)) {
    throw new ApplicationDeploymentDuplicateError(deployment.metadata.name);
  }
  await fs.mkdir(outputDir, {recursive: true});

  // render each manifest into the output directory
  const absManifestDir = path.join(templateDir, relativeManifestDir);
  for (const inputFile of await fs.readdir(absManifestDir)) {
    const absPath = path.join(absManifestDir, inputFile);
    const manifest = await fs.readFile(absPath, 'utf8');

    const renderedManifest = Mustache.render(manifest, values);

    const outputFile = path.join(outputDir, `${inputFile}`);
    await fs.writeFile(outputFile, renderedManifest);
  }
}

async function dereferenceApplication(application: ApplicationDeployment) {
  const appDir = await cloneWithSparseCheckout(
    application.spec.repo,
    [application.spec.path],
    application.spec.ref
  );

  const appYamlPath = path.join(appDir, application.spec.path);
  return await load<Application>(appYamlPath, applicationSchema);
}

export function generateValues(
  template: Template,
  application: Application,
  deployment: ApplicationDeployment
): Record<string, string | number> {
  const templateDefaults: Record<string, string | number> = {};
  for (const [key, value] of Object.entries(template.parameters)) {
    if (value.default) {
      templateDefaults[key] = value.default;
    }
  }

  const values = {
    ...templateDefaults,
    ...application.values,
    ...deployment.spec.values?.overrides,
  };

  const keys = new Set(Object.keys(values));
  const missingParams = Object.keys(template.parameters).filter(
    p => !keys.has(p)
  );
  if (missingParams.length > 0) {
    throw new MissingParametersError(application.template, missingParams);
  }

  return values;
}
