import {renderAll} from '../render';
import {ControlPlaneClient} from '../controlPlaneClient';

export async function renderCommand(
  controlPlaneRepo: string,
  clusterGitopsRepo: string
) {
  // gather the necessary data to make assignments
  const controlPlane = new ControlPlaneClient(controlPlaneRepo);
  const applications = await controlPlane.getApplications();
  const templates = await controlPlane.getTemplates();

  await renderAll(applications, templates, clusterGitopsRepo);

  console.log(
    `Rendered templates from ${controlPlaneRepo} to ${clusterGitopsRepo}`
  );
}
