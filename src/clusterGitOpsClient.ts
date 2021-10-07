import {ApplicationAssignment, Cluster} from '.';

interface Kustomization {
  apiVersion: string;
  kind: 'Kustomization';
  metadata: {
    name: string;
    annotations?: {
      [k: string]: string;
    };
  };
  resources: string[];
}

export class ClusterGitOpsClient {
  private localPath: string;

  constructor(localPath: string) {
    this.localPath = localPath;
  }

  async apply(clusters: Cluster[], assignments: ApplicationAssignment[]) {
    // prune clusters not present in the cluster list
    // for each cluster:
    // clear the target directory
    // populate the target directory with the base cluster files, with placeholders filled in
    // for each application assigned to the cluster
    // add a file that points to the correct location in /applications
    // update kustomization.yaml to include the above file
  }
}
