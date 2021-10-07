import {assignAll, AssignmentContext} from '../assignment';
import {ControlPlaneClient} from '../controlPlaneClient';

export async function assignCommand(controlPlaneRepo: string) {
  // gather the necessary data to make assignments
  const controlPlane = new ControlPlaneClient(controlPlaneRepo);
  const clusters = await controlPlane.getClusters();
  const controlPlaneAssignments = await controlPlane.getAssignments();
  const applications = await controlPlane.getApplications();

  // assign applications
  const context: AssignmentContext = {
    clusters,
    assignments: controlPlaneAssignments,
  };
  const operations = assignAll(context, applications);

  // apply assignment operations to the control plane repo
  for (const o of operations) {
    console.log(
      `operation: ${o.operation}; app: ${o.assignment.spec.application}; cluster: ${o.assignment.spec.cluster}`
    );
    if (o.operation === 'create') {
      console.log(
        `Creating assignment ${o.assignment.spec.application}:${o.assignment.spec.cluster}`
      );
      await controlPlane.addAssignment(o.assignment);
    } else if (o.operation === 'delete') {
      console.log(
        `Deleting assignment ${o.assignment.spec.application}:${o.assignment.spec.cluster}`
      );
      await controlPlane.deleteAssignment(o.assignment.metadata.name);
    } else {
      console.log(
        `Skipping assignment ${o.assignment.spec.application}:${o.assignment.spec.cluster}`
      );
    }
  }

  console.log(
    `Processed ${operations.length} assignments in ${controlPlaneRepo}`
  );
}
