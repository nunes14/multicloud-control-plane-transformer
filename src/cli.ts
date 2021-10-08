import {Command} from 'commander';
import {applyCommand} from './commands/apply';
import {assignCommand} from './commands/assign';
import {renderCommand} from './commands/render';

export const program = new Command();

program
  .command('apply <control-plane-repo> <cluster-gitops-repo>')
  .description(
    'Update the cluster gitops repo from the current control plane configuration'
  )
  .action(applyCommand);

program
  .command('assign <control-plane-repo>')
  .description('Generate assignments for applications to clusters')
  .action(assignCommand);

program
  .command('render <control-plane-repo> <cluster-gitops-repo>')
  .description('Render application templates to the cluster gitops repo')
  .action(renderCommand);
