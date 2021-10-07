import {Command} from 'commander';
import {applyCommand} from './commands/apply';
import {assignCommand} from './commands/assign';
import {renderCommand} from './commands/render';

export const program = new Command();

program
  .command('apply <control-plane-repo> <cluster-gitops-repo>')
  .action(applyCommand);
program.command('assign <control-plane-repo>').action(assignCommand);
program
  .command('render <control-plane-repo> <cluster-gitops-repo>')
  .action(renderCommand);
