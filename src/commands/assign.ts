import {assignAll, AssignmentContext} from '../assignment';
import {ControlPlaneClient} from '../controlPlaneClient';
import {Logger} from "winston";

export async function assignCommand(controlPlaneRepo: string, logger: Logger) {
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
    logger.verbose(
      `operation: ${o.operation}; app: ${o.assignment.spec.application}; cluster: ${o.assignment.spec.cluster}`
    );
    if (o.operation === 'create') {
      logger.verbose(
        `Creating assignment ${o.assignment.spec.application}:${o.assignment.spec.cluster}`
      );
      await controlPlane.addAssignment(o.assignment);
    } else if (o.operation === 'delete') {
      logger.verbose(
        `Deleting assignment ${o.assignment.spec.application}:${o.assignment.spec.cluster}`
      );
      await controlPlane.deleteAssignment(o.assignment.metadata.name);
    } else {
      logger.verbose(
        `Skipping assignment ${o.assignment.spec.application}:${o.assignment.spec.cluster}`
      );
    }
  }

  logger.verbose(
    `Processed ${operations.length} assignments in ${controlPlaneRepo}`
  );
}
