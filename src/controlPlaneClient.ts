import {promises as fs} from 'fs';
import path = require('path');
import * as yaml from 'js-yaml';

import {
  ApplicationAssignment,
  ApplicationDeployment,
  ApplicationTemplate,
  Cluster,
} from '.';
import {loadAll} from './loader';

import schema = require('../schemas/controlplane.json');

/** A client for interacting with the contents of the control plane repository */
export class ControlPlaneClient {
  private localPath: string;

  constructor(localPath: string) {
    this.localPath = localPath;
  }

  async getApplications(): Promise<ApplicationDeployment[]> {
    const dir = path.join(this.localPath, 'applications');
    return await loadAll<ApplicationDeployment>(
      dir,
      schema.$defs.ApplicationDeployment
    );
  }

  async getApplicationPath(name: string): Promise<string> {
    return path.join(this.localPath, 'applications', `${name}.yaml`);
  }

  async addApplication(application: ApplicationDeployment): Promise<void> {
    const filePath = await this.getApplicationPath(application.metadata.name);
    await fs.writeFile(filePath, yaml.dump(application));
  }

  async getAssignments(): Promise<ApplicationAssignment[]> {
    const dir = path.join(this.localPath, 'assignments');
    return await loadAll<ApplicationAssignment>(
      dir,
      schema.$defs.ApplicationAssignment
    );
  }

  async getAssignmentPath(name: string): Promise<string> {
    return path.join(this.localPath, 'assignments', `${name}.yaml`);
  }

  async addAssignment(assignment: ApplicationAssignment): Promise<void> {
    const filePath = await this.getAssignmentPath(assignment.metadata.name);
    await fs.writeFile(filePath, yaml.dump(assignment));
  }

  async deleteAssignment(name: string): Promise<void> {
    const filePath = await this.getAssignmentPath(name);
    await fs.unlink(filePath);
  }

  async getClusters(): Promise<Cluster[]> {
    const dir = path.join(this.localPath, 'clusters');
    return await loadAll<Cluster>(dir, schema.$defs.Cluster);
  }

  async getClusterPath(name: string): Promise<string> {
    return path.join(this.localPath, 'clusters', `${name}.yaml`);
  }

  async addCluster(cluster: Cluster): Promise<void> {
    const filePath = await this.getClusterPath(cluster.metadata.name);
    await fs.writeFile(filePath, yaml.dump(cluster));
  }

  async getTemplates(): Promise<ApplicationTemplate[]> {
    const dir = path.join(this.localPath, 'templates');
    return await loadAll<ApplicationTemplate>(
      dir,
      schema.$defs.ApplicationTemplate
    );
  }

  async getTemplatePath(name: string): Promise<string> {
    return path.join(this.localPath, 'templates', `${name}.yaml`);
  }

  async addTemplate(template: ApplicationTemplate): Promise<void> {
    const filePath = await this.getTemplatePath(template.metadata.name);
    await fs.writeFile(filePath, yaml.dump(template));
  }
}
