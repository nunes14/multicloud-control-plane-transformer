import {ClusterGitOpsClient} from '../clusterGitOpsClient';
import {ControlPlaneClient} from '../controlPlaneClient';

export async function applyCommand(
  controlPlaneRepo: string,
  clusterGitopsRepo: string
) {
  // gather the necessary data to make assignments
  const controlPlane = new ControlPlaneClient(controlPlaneRepo);
  const assignments = await controlPlane.getAssignments();
  const clusters = await controlPlane.getClusters();

  const gitops = new ClusterGitOpsClient(clusterGitopsRepo);
  await gitops.apply(clusters, assignments);

  console.log(
    `Applied assignments from ${controlPlaneRepo} to ${clusterGitopsRepo}`
  );
}
