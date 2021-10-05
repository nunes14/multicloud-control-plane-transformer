import {expect} from 'chai';
import {ApplicationAssignment, ApplicationDeployment, Cluster} from '../src';
import {
  assign,
  assignAll,
  AssignmentContext,
  InsufficientClustersError,
} from '../src/assignment';

function buildCluster(
  name: string,
  environments?: string[],
  labels?: Record<string, string>
): Cluster {
  return {
    kind: 'Cluster',
    metadata: {name, labels},
    spec: {
      environments,
    },
  };
}

function buildApp(
  name: string,
  clusters: number | 'all' = 1
): ApplicationDeployment {
  return {
    kind: 'ApplicationDeployment',
    metadata: {
      name,
    },
    spec: {
      clusters,
      repo: '',
      ref: '',
      path: '',
    },
  };
}

function buildAssignment(
  application: string,
  cluster: string
): ApplicationAssignment {
  return {
    kind: 'ApplicationAssignment',
    metadata: {
      name: `${application}-${cluster}`,
    },
    spec: {
      application,
      cluster,
    },
  };
}

describe('assignment', () => {
  describe('application create', () => {
    it('creates an assignment when a new application matches a cluster', () => {
      const context: AssignmentContext = {
        assignments: [],
        clusters: [buildCluster('cluster1'), buildCluster('cluster2')],
      };
      const application = buildApp('app1');

      const operations = assign(context, application);

      expect(operations.length).to.equal(1);
      expect(operations[0].operation).to.equal('create');
      expect(operations[0].assignment.spec.application).to.equal('app1');
      expect(operations[0].assignment.spec.cluster).to.be.oneOf([
        'cluster1',
        'cluster2',
      ]);
    });

    it('creates multiple assignments for an application', () => {
      const context: AssignmentContext = {
        assignments: [],
        clusters: [
          buildCluster('cluster1'),
          buildCluster('cluster2'),
          buildCluster('cluster3'),
        ],
      };
      const application = buildApp('app1', 2);

      const operations = assign(context, application);

      expect(operations.length).to.equal(2);
      expect(operations[0].operation).to.equal('create');
      expect(operations[1].operation).to.equal('create');
    });

    it('assigns to all clusters for an application with clusters:all', () => {
      const context: AssignmentContext = {
        assignments: [],
        clusters: [
          buildCluster('cluster1'),
          buildCluster('cluster2'),
          buildCluster('cluster3'),
        ],
      };
      const application = buildApp('app1', 'all');

      const operations = assign(context, application);

      expect(operations.length).to.equal(3);
      expect(operations[0].operation).to.equal('create');
      expect(operations[1].operation).to.equal('create');
      expect(operations[2].operation).to.equal('create');
    });
  });

  describe('application update', () => {
    it('creates additional assignments to meet the new needs of an application', () => {
      const context: AssignmentContext = {
        assignments: [
          buildAssignment('app1', 'cluster1'),
          buildAssignment('app1', 'cluster2'),
        ],
        clusters: [
          buildCluster('cluster1'),
          buildCluster('cluster2'),
          buildCluster('cluster3'),
        ],
      };
      const application = buildApp('app1', 2);

      const operations = assign(context, application);
      expect(operations.length).to.equal(2);

      // Increase the number of deployments
      application.spec.clusters = 3;
      const operations2 = assign(context, application);

      expect(operations2.length).to.equal(3);

      expect(operations2).to.deep.include({
        operation: 'keep',
        assignment: context.assignments[0],
      });
      expect(operations2).to.deep.include({
        operation: 'keep',
        assignment: context.assignments[1],
      });
      expect(operations2).to.deep.include({
        operation: 'create',
        assignment: buildAssignment('app1', 'cluster3'),
      });
    });

    it('creates assignments an application selector is updated to match additional clusters', () => {
      const context: AssignmentContext = {
        assignments: [buildAssignment('app1', 'cluster1')],
        clusters: [
          buildCluster('cluster1', ['prod'], {
            ring: 'preview',
          }),
          buildCluster('cluster2', ['prod'], {
            ring: 'public',
          }),
          buildCluster('cluster3', ['prod'], {
            ring: 'public',
          }),
        ],
      };
      const application = buildApp('app1', 'all');
      application.spec.selector = {
        environment: 'prod',
        ring: 'preview',
      };

      const operations = assign(context, application);
      expect(operations.length).to.equal(1);

      // Remove the "ring" criteria to select all prod clusters
      application.spec.selector = {
        environment: 'prod',
      };

      const operations2 = assign(context, application);
      expect(operations2.length).to.equal(3);
      expect(operations2).to.deep.include({
        operation: 'keep',
        assignment: context.assignments[0],
      });
      expect(operations2).to.deep.include({
        operation: 'create',
        assignment: buildAssignment('app1', 'cluster2'),
      });
      expect(operations2).to.deep.include({
        operation: 'create',
        assignment: buildAssignment('app1', 'cluster3'),
      });
    });

    it('removes assignments when an application selector is updated to match fewer clusters', () => {
      const context: AssignmentContext = {
        assignments: [
          buildAssignment('app1', 'cluster1'),
          buildAssignment('app1', 'cluster2'),
          buildAssignment('app1', 'cluster3'),
        ],
        clusters: [
          buildCluster('cluster1', ['prod'], {
            ring: 'preview',
          }),
          buildCluster('cluster2', ['prod'], {
            ring: 'public',
          }),
          buildCluster('cluster3', ['prod'], {
            ring: 'public',
          }),
        ],
      };
      const application = buildApp('app1', 'all');
      application.spec.selector = {
        environment: 'prod',
      };

      const operations = assign(context, application);
      expect(operations.length).to.equal(3);

      // Add the "ring" criteria to limit the deployment
      application.spec.selector = {
        environment: 'prod',
        ring: 'preview',
      };

      const operations2 = assign(context, application);
      expect(operations2.length).to.equal(3);
      expect(operations2).to.deep.include({
        operation: 'keep',
        assignment: context.assignments[0],
      });
      expect(operations2).to.deep.include({
        operation: 'delete',
        assignment: context.assignments[1],
      });
      expect(operations2).to.deep.include({
        operation: 'delete',
        assignment: context.assignments[2],
      });
    });

    it('removes assignments when there are more existing assignments than specified by an application', () => {
      const context: AssignmentContext = {
        assignments: [
          buildAssignment('app1', 'cluster1'),
          buildAssignment('app1', 'cluster2'),
          buildAssignment('app1', 'cluster3'),
        ],
        clusters: [
          buildCluster('cluster1'),
          buildCluster('cluster2'),
          buildCluster('cluster3'),
        ],
      };
      const application = buildApp('app1', 3);

      const operations = assign(context, application);
      expect(operations.length).to.equal(3);

      // Reduce the number of deployments
      application.spec.clusters = 1;

      const operations2 = assign(context, application);
      expect(operations2.length).to.equal(3);

      const keeps = operations2.filter(o => o.operation === 'keep').length;
      expect(keeps).to.equal(1);

      const deletes = operations2.filter(o => o.operation === 'delete').length;
      expect(deletes).to.equal(2);
    });
  });

  describe('application delete', () => {
    it('removes assignments when an application is deleted', () => {
      const context: AssignmentContext = {
        assignments: [
          buildAssignment('app1', 'cluster1'),
          buildAssignment('app2', 'cluster2'),
        ],
        clusters: [buildCluster('cluster1'), buildCluster('cluster2')],
      };
      const applications = [buildApp('app2')];

      const operations = assignAll(context, applications);

      expect(operations.length).to.equal(2);
      expect(operations).to.deep.include({
        operation: 'delete',
        assignment: context.assignments[0],
      });
      expect(operations).to.deep.include({
        operation: 'keep',
        assignment: context.assignments[1],
      });
    });
  });

  describe('cluster create', () => {
    it('creates assignments when a matching cluster is created for an application with clusters:all', () => {
      const context: AssignmentContext = {
        assignments: [buildAssignment('app1', 'cluster1')],
        clusters: [
          buildCluster('cluster1'),
          buildCluster('cluster2'),
          buildCluster('cluster3'),
        ],
      };
      const application = buildApp('app1', 'all');

      const operations = assign(context, application);

      expect(operations.length).to.equal(3);
      expect(operations).to.deep.include({
        operation: 'keep',
        assignment: context.assignments[0],
      });
      expect(operations).to.deep.include({
        operation: 'create',
        assignment: buildAssignment('app1', 'cluster2'),
      });
      expect(operations).to.deep.include({
        operation: 'create',
        assignment: buildAssignment('app1', 'cluster3'),
      });
    });
  });

  describe('cluster update', () => {
    it('creates assignments when an existing cluster is updated to match an existing application with clusters:all', () => {
      const context: AssignmentContext = {
        assignments: [
          buildAssignment('app1', 'cluster1'),
          buildAssignment('app1', 'cluster2'),
        ],
        clusters: [
          buildCluster('cluster1', [], {
            ring: 'prod',
          }),
          buildCluster('cluster2', [], {
            ring: 'prod',
          }),
          buildCluster('cluster3', [], {
            ring: 'validation',
          }),
        ],
      };
      const application = buildApp('app1', 'all');
      application.spec.selector = {
        ring: 'prod',
      };

      const operations = assign(context, application);
      expect(operations.length).to.equal(2);

      context.clusters[2].metadata.labels!.ring = 'prod';

      const operations2 = assign(context, application);
      expect(operations2.length).to.equal(3);
      expect(operations2).to.deep.include({
        operation: 'keep',
        assignment: context.assignments[0],
      });
      expect(operations2).to.deep.include({
        operation: 'keep',
        assignment: context.assignments[1],
      });
      expect(operations2).to.deep.include({
        operation: 'create',
        assignment: buildAssignment('app1', 'cluster3'),
      });
    });

    it('removes assignments when an existing cluster is updated and no longer matches an application selector', () => {
      const context: AssignmentContext = {
        assignments: [
          buildAssignment('app1', 'cluster1'),
          buildAssignment('app1', 'cluster2'),
          buildAssignment('app1', 'cluster3'),
        ],
        clusters: [
          buildCluster('cluster1', [], {
            ring: 'prod',
          }),
          buildCluster('cluster2', [], {
            ring: 'prod',
          }),
          buildCluster('cluster3', [], {
            ring: 'prod',
          }),
        ],
      };
      const application = buildApp('app1', 'all');
      application.spec.selector = {
        ring: 'prod',
      };

      const operations = assign(context, application);
      expect(operations.length).to.equal(3);

      context.clusters[2].metadata.labels!.ring = 'offline';

      const operations2 = assign(context, application);
      expect(operations2.length).to.equal(3);
      expect(operations2).to.deep.include({
        operation: 'keep',
        assignment: context.assignments[0],
      });
      expect(operations2).to.deep.include({
        operation: 'keep',
        assignment: context.assignments[1],
      });
      expect(operations2).to.deep.include({
        operation: 'delete',
        assignment: context.assignments[2],
      });
    });
  });

  describe('cluster delete', () => {
    it('removes assignments when a cluster is deleted', () => {
      const context: AssignmentContext = {
        assignments: [
          buildAssignment('app1', 'cluster1'),
          buildAssignment('app1', 'cluster2'),
        ],
        clusters: [buildCluster('cluster2'), buildCluster('cluster3')],
      };
      const application = buildApp('app1', 2);

      const operations = assign(context, application);

      expect(operations.length).to.equal(3);
      expect(operations).to.deep.include({
        operation: 'delete',
        assignment: context.assignments[0],
      });
      expect(operations).to.deep.include({
        operation: 'keep',
        assignment: context.assignments[1],
      });
      expect(operations).to.deep.include({
        operation: 'create',
        assignment: buildAssignment('app1', 'cluster3'),
      });
    });
  });

  describe('selection', () => {
    it('assigns an application to a cluster with a matching environment', () => {
      const context: AssignmentContext = {
        assignments: [],
        clusters: [
          buildCluster('cluster1', ['dev']),
          buildCluster('cluster2', ['prod']),
        ],
      };
      const application = buildApp('app1');
      application.spec.selector = {
        environment: 'prod',
      };

      const operations = assign(context, application);

      expect(operations.length).to.equal(1);
      expect(operations[0].operation).to.equal('create');
      expect(operations[0].assignment.spec.application).to.equal('app1');
      expect(operations[0].assignment.spec.cluster).to.equal('cluster2');
    });

    it('does not assign an application to a cluster with no environment', () => {
      const context: AssignmentContext = {
        assignments: [],
        clusters: [buildCluster('cluster1'), buildCluster('cluster2', ['dev'])],
      };
      delete context.clusters[0].spec.environments;

      const application = buildApp('app1');
      application.spec.selector = {
        environment: 'dev',
      };

      const operations = assign(context, application);

      expect(operations.length).to.equal(1);
      expect(operations).to.deep.include({
        operation: 'create',
        assignment: buildAssignment('app1', 'cluster2'),
      });
    });

    it('does not assign an application to a cluster with no labels', () => {
      const context: AssignmentContext = {
        assignments: [],
        clusters: [
          buildCluster('cluster1', []),
          buildCluster('cluster2', [], {
            ring: 'public',
          }),
        ],
      };
      delete context.clusters[0].metadata.labels;

      const application = buildApp('app1');
      application.spec.selector = {
        ring: 'public',
      };

      const operations = assign(context, application);

      expect(operations.length).to.equal(1);
      expect(operations).to.deep.include({
        operation: 'create',
        assignment: buildAssignment('app1', 'cluster2'),
      });
    });

    it('assigns an application to a cluster with multiple environments', () => {
      const context: AssignmentContext = {
        assignments: [],
        clusters: [
          buildCluster('cluster1', ['dev']),
          buildCluster('cluster2', ['staging', 'prod']),
        ],
      };
      const application = buildApp('app1');
      application.spec.selector = {
        environment: 'staging',
      };

      const operations = assign(context, application);

      expect(operations.length).to.equal(1);
      expect(operations[0].operation).to.equal('create');
      expect(operations[0].assignment.spec.application).to.equal('app1');
      expect(operations[0].assignment.spec.cluster).to.equal('cluster2');
    });

    it('assigns an application to a cluster with a matching label', () => {
      const context: AssignmentContext = {
        assignments: [],
        clusters: [
          buildCluster('cluster1', [], {geo: 'US'}),
          buildCluster('cluster2', [], {geo: 'EMEA'}),
        ],
      };
      const application = buildApp('app1');
      application.spec.selector = {
        geo: 'US',
      };

      const operations = assign(context, application);

      expect(operations.length).to.equal(1);
      expect(operations[0].operation).to.equal('create');
      expect(operations[0].assignment.spec.application).to.equal('app1');
      expect(operations[0].assignment.spec.cluster).to.equal('cluster1');
    });

    it('assigns an application to a cluster with multiple matching labels', () => {
      const context: AssignmentContext = {
        assignments: [],
        clusters: [
          buildCluster('cluster1', [], {geo: 'US', ring: 'insiders'}),
          buildCluster('cluster2', [], {geo: 'EMEA', ring: 'public'}),
        ],
      };
      const application = buildApp('app1');
      application.spec.selector = {
        geo: 'US',
        ring: 'insiders',
      };

      const operations = assign(context, application);

      expect(operations.length).to.equal(1);
      expect(operations[0].operation).to.equal('create');
      expect(operations[0].assignment.spec.application).to.equal('app1');
      expect(operations[0].assignment.spec.cluster).to.equal('cluster1');
    });

    it('assigns an application to multiple clusters with a matching label', () => {
      const context: AssignmentContext = {
        assignments: [],
        clusters: [
          buildCluster('cluster1', [], {
            geo: 'US',
            ring: 'insiders',
            cloud: 'azure',
          }),
          buildCluster('cluster2', [], {
            geo: 'EMEA',
            ring: 'public',
            cloud: 'aws',
          }),
          buildCluster('cluster3', [], {
            geo: 'US',
            ring: 'public',
            cloud: 'azure',
          }),
        ],
      };
      const application = buildApp('app1', 2);
      application.spec.selector = {
        ring: 'public',
      };

      const operations = assign(context, application);

      expect(operations.length).to.equal(2);
      expect(operations[0].operation).to.equal('create');
      expect(operations[0].assignment.spec.application).to.equal('app1');
      expect(operations[0].assignment.spec.cluster).to.be.oneOf([
        'cluster2',
        'cluster3',
      ]);

      expect(operations[1].operation).to.equal('create');
      expect(operations[1].assignment.spec.application).to.equal('app1');
      expect(operations[1].assignment.spec.cluster).to.be.oneOf([
        'cluster2',
        'cluster3',
      ]);
    });

    it('assigns an application to multiple clusters with multiple matching label', () => {
      const context: AssignmentContext = {
        assignments: [],
        clusters: [
          buildCluster('cluster1', [], {
            geo: 'US',
            ring: 'insiders',
            cloud: 'azure',
          }),
          buildCluster('cluster2', [], {
            geo: 'EMEA',
            ring: 'public',
            cloud: 'aws',
          }),
          buildCluster('cluster3', [], {
            geo: 'US',
            ring: 'public',
            cloud: 'azure',
          }),
          buildCluster('cluster3', [], {
            geo: 'EMEA',
            ring: 'public',
            cloud: 'azure',
          }),
        ],
      };
      const application = buildApp('app1', 2);
      application.spec.selector = {
        ring: 'public',
        cloud: 'azure',
      };

      const operations = assign(context, application);

      expect(operations.length).to.equal(2);
      expect(operations[0].operation).to.equal('create');
      expect(operations[0].assignment.spec.application).to.equal('app1');
      expect(operations[0].assignment.spec.cluster).to.be.oneOf([
        'cluster3',
        'cluster4',
      ]);

      expect(operations[1].operation).to.equal('create');
      expect(operations[1].assignment.spec.application).to.equal('app1');
      expect(operations[1].assignment.spec.cluster).to.be.oneOf([
        'cluster3',
        'cluster4',
      ]);
    });

    it('assigns an application to all clusters with a matching label', () => {
      const context: AssignmentContext = {
        assignments: [],
        clusters: [
          buildCluster('cluster1', [], {
            geo: 'US',
            ring: 'insiders',
            cloud: 'azure',
          }),
          buildCluster('cluster2', [], {
            geo: 'EMEA',
            ring: 'public',
            cloud: 'aws',
          }),
          buildCluster('cluster3', [], {
            geo: 'US',
            ring: 'public',
            cloud: 'azure',
          }),
          buildCluster('cluster3', [], {
            geo: 'EMEA',
            ring: 'public',
            cloud: 'azure',
          }),
        ],
      };
      const application = buildApp('app1', 'all');
      application.spec.selector = {
        ring: 'public',
      };

      const operations = assign(context, application);

      expect(operations.length).to.equal(3);
      expect(operations[0].operation).to.equal('create');
      expect(operations[0].assignment.spec.application).to.equal('app1');
      expect(operations[0].assignment.spec.cluster).to.be.oneOf([
        'cluster2',
        'cluster3',
        'cluster4',
      ]);

      expect(operations[1].operation).to.equal('create');
      expect(operations[1].assignment.spec.application).to.equal('app1');
      expect(operations[1].assignment.spec.cluster).to.be.oneOf([
        'cluster2',
        'cluster3',
        'cluster4',
      ]);

      expect(operations[2].operation).to.equal('create');
      expect(operations[2].assignment.spec.application).to.equal('app1');
      expect(operations[2].assignment.spec.cluster).to.be.oneOf([
        'cluster2',
        'cluster3',
        'cluster4',
      ]);
    });

    it('assigns an application to all clusters with multiple matching labels', () => {
      const context: AssignmentContext = {
        assignments: [],
        clusters: [
          buildCluster('cluster1', [], {
            geo: 'US',
            ring: 'insiders',
            cloud: 'azure',
          }),
          buildCluster('cluster2', [], {
            geo: 'EMEA',
            ring: 'public',
            cloud: 'aws',
          }),
          buildCluster('cluster3', [], {
            geo: 'US',
            ring: 'public',
            cloud: 'azure',
          }),
          buildCluster('cluster3', [], {
            geo: 'EMEA',
            ring: 'public',
            cloud: 'azure',
          }),
        ],
      };
      const application = buildApp('app1', 'all');
      application.spec.selector = {
        geo: 'US',
        cloud: 'azure',
      };

      const operations = assign(context, application);

      expect(operations.length).to.equal(2);
      expect(operations[0].operation).to.equal('create');
      expect(operations[0].assignment.spec.application).to.equal('app1');
      expect(operations[0].assignment.spec.cluster).to.be.oneOf([
        'cluster1',
        'cluster3',
      ]);

      expect(operations[1].operation).to.equal('create');
      expect(operations[1].assignment.spec.application).to.equal('app1');
      expect(operations[1].assignment.spec.cluster).to.be.oneOf([
        'cluster1',
        'cluster3',
      ]);
    });

    it('warns when there are no matching clusters for an application', () => {
      const context: AssignmentContext = {
        assignments: [],
        clusters: [buildCluster('cluster1', ['dev'])],
      };
      const application = buildApp('app1');
      application.spec.selector = {
        environment: 'prod',
      };

      const originalWarn = console.warn;
      try {
        let warned = false;
        console.warn = () => {
          warned = true;
        };

        assign(context, application);

        expect(warned).to.equal(true);
      } finally {
        console.log = originalWarn;
      }
    });
  });

  describe('assignments', () => {
    it('keeps existing assignments if the right number of assignments already exist', () => {
      const context: AssignmentContext = {
        assignments: [
          buildAssignment('app1', 'cluster1'),
          buildAssignment('app1', 'cluster2'),
        ],
        clusters: [
          buildCluster('cluster1'),
          buildCluster('cluster2'),
          buildCluster('cluster3'),
        ],
      };
      const application = buildApp('app1', 2);

      const operations = assign(context, application);

      expect(operations.length).to.equal(2);
      expect(operations[0].operation).to.equal('keep');
      expect(operations[1].operation).to.equal('keep');
    });

    it('keeps existing assignments if the right number of assignments already exist for clusters:all', () => {
      const context: AssignmentContext = {
        assignments: [
          buildAssignment('app1', 'cluster1'),
          buildAssignment('app1', 'cluster2'),
          buildAssignment('app1', 'cluster3'),
        ],
        clusters: [
          buildCluster('cluster1'),
          buildCluster('cluster2'),
          buildCluster('cluster3'),
        ],
      };
      const application = buildApp('app1', 'all');

      const operations = assign(context, application);

      expect(operations.length).to.equal(3);
      expect(operations[0].operation).to.equal('keep');
      expect(operations[1].operation).to.equal('keep');
      expect(operations[2].operation).to.equal('keep');
    });

    it('creates new assignments when an existing assignment is removed', () => {
      const context: AssignmentContext = {
        assignments: [
          buildAssignment('app1', 'cluster1'),
          buildAssignment('app1', 'cluster2'),
        ],
        clusters: [
          buildCluster('cluster1'),
          buildCluster('cluster2'),
          buildCluster('cluster3'),
        ],
      };
      const application = buildApp('app1', 2);

      const operations = assign(context, application);
      expect(operations.length).to.equal(2);

      // Remove an assignment and reassign
      context.assignments.pop();
      const operations2 = assign(context, application);

      expect(operations2.length).to.equal(2);

      expect(operations2).to.deep.include({
        operation: 'keep',
        assignment: context.assignments[0],
      });
      expect(operations2[1].operation).to.equal('create');
      expect(operations2[1].assignment.spec.cluster).to.be.oneOf([
        'cluster2',
        'cluster3',
      ]);
    });

    it('throws when an application specifies more than the number of matching clusters', () => {
      const context: AssignmentContext = {
        assignments: [],
        clusters: [buildCluster('cluster1')],
      };
      const application = buildApp('app1', 2);

      expect(() => assign(context, application)).to.throw(
        InsufficientClustersError
      );
    });
  });
});
