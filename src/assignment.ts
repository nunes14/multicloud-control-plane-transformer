import {ApplicationAssignment, ApplicationDeployment, Cluster} from '.';

/** Supporting information used in assigning applications to clusters */
export interface AssignmentContext {
  assignments: ApplicationAssignment[];
  clusters: Cluster[];
}

/** Operations to be reconciled against the cluster gitops repo */
export interface AssignmentOperation {
  operation: 'create' | 'delete' | 'keep';
  assignment: ApplicationAssignment;
}

type ValidatedAssignment = {
  isValid: boolean;
  assignment: ApplicationAssignment;
};

/** Assignment currently supports a maximum of one assignment of an application per cluster */
export class InsufficientClustersError extends Error {
  constructor(requested: number, available: number) {
    super(
      `Requested ${requested} assignments, but only ${available} clusters are available`
    );
  }
}

/** Generate assignment operations for all applications in the system */
export function assignAll(
  context: AssignmentContext,
  applications: ApplicationDeployment[]
): AssignmentOperation[] {
  const appNames = new Set(applications.map(a => a.metadata.name));

  const operations: AssignmentOperation[] = [];
  for (const assignment of context.assignments.filter(
    a => !appNames.has(a.spec.application)
  )) {
    operations.push({
      operation: 'delete',
      assignment,
    });
  }

  const appOperations = applications.flatMap(a => assign(context, a));
  operations.push(...appOperations);

  return operations;
}

/** Generate assignment operations for a single application */
export function assign(
  context: AssignmentContext,
  application: ApplicationDeployment
): AssignmentOperation[] {
  const eligibleClusters = filterClusters(context.clusters, application);
  const currentAssignments = validateAssignments(
    eligibleClusters,
    context.assignments,
    application
  );
  const validAssignments = currentAssignments.filter(a => a.isValid);
  const desiredAssignmentCount =
    application.spec.clusters === 'all'
      ? eligibleClusters.length
      : application.spec.clusters;

  const operations: AssignmentOperation[] = [];

  // identify assignments that should be removed
  const invalidAssignmentOperations: AssignmentOperation[] = currentAssignments
    .filter(a => !a.isValid)
    .map(a => ({
      operation: 'delete',
      assignment: a.assignment,
    }));
  operations.push(...invalidAssignmentOperations);

  // keep or delete existing assignments
  const assignmentsToRemove = validAssignments.length - desiredAssignmentCount;
  for (let i = 0; i < validAssignments.length; i++) {
    const operation = i < assignmentsToRemove ? 'delete' : 'keep';
    operations.push({
      operation,
      assignment: validAssignments[i].assignment,
    });
  }

  // add new assignments to meet the target count
  const newAssignments = generateNewAssignments(
    validAssignments,
    eligibleClusters,
    application,
    desiredAssignmentCount
  );
  operations.push(...newAssignments);

  return operations;
}

/** Evaluate current assignments against a list of eligible clusters */
function validateAssignments(
  clusters: Cluster[],
  assignments: ApplicationAssignment[],
  application: ApplicationDeployment
): ValidatedAssignment[] {
  const clusterNames = new Set(clusters.map(c => c.metadata.name));
  return assignments
    .filter(a => a.spec.application === application.metadata.name)
    .map(a => ({
      isValid: clusterNames.has(a.spec.cluster),
      assignment: a,
    }));
}

/** Generate new cluster assignments given its current assignments, possible clusters, and the target count  */
function generateNewAssignments(
  currentAssignments: ValidatedAssignment[],
  clusters: Cluster[],
  application: ApplicationDeployment,
  count: number
): AssignmentOperation[] {
  if (clusters.length === 0) {
    return [];
  }

  const newAssignmentCount = count - currentAssignments.length;
  const scheduledClusters = new Set(
    currentAssignments.map(a => a.assignment.spec.cluster)
  );
  const unscheduledClusters = clusters.filter(
    c => !scheduledClusters.has(c.metadata.name)
  );

  // assumes a cluster can only have a single deployment of an application
  if (newAssignmentCount > unscheduledClusters.length) {
    throw new InsufficientClustersError(
      newAssignmentCount,
      unscheduledClusters.length
    );
  }

  // randomly shuffle, pick one or more items, and create new assignments
  return getRandomElements(unscheduledClusters, newAssignmentCount).map(c => ({
    operation: 'create',
    assignment: createAssignment(application, c),
  }));
}

/** Return the list of clusters that are eligible to host an application */
function filterClusters(
  clusters: Cluster[],
  application: ApplicationDeployment
): Cluster[] {
  const selector = application.spec.selector;

  // all clusters are eligible if no selector is provided
  if (!selector) {
    return clusters;
  }

  const eligibleClusters = clusters.filter(c => isEligible(c, selector));
  if (eligibleClusters.length === 0) {
    console.warn(
      `There are no eligible clusters for application: ${application.metadata.name}`
    );
  }
  return eligibleClusters;
}

/** Determine whether a cluster is eligible to host an application */
function isEligible(
  cluster: Cluster,
  selector: Record<string, string>
): boolean {
  // check each property in the selector
  for (const [key, value] of Object.entries(selector)) {
    // cluster environments must contain the selector environment
    if (key === 'environment') {
      if (!cluster.spec.environments?.includes(value)) {
        return false;
      }
    }

    // cluster labels must match selector labels
    else if (cluster.metadata.labels?.[key] !== value) {
      return false;
    }
  }

  return true;
}

function createAssignment(
  application: ApplicationDeployment,
  cluster: Cluster
): ApplicationAssignment {
  return {
    kind: 'ApplicationAssignment',
    metadata: {
      name: `${application.metadata.name}-${cluster.metadata.name}`,
    },
    spec: {
      application: application.metadata.name,
      cluster: cluster.metadata.name,
    },
  };
}

function getRandomElements<T>(list: Array<T>, count: number) {
  return list.sort(() => 0.5 - Math.random()).slice(0, count);
}
