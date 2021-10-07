import {Command} from 'commander';
import {assignCommand} from './commands/assign';
import {renderCommand} from './commands/render';

export const program = new Command();

program.command('assign <control-plane-repo>').action(assignCommand);
program
  .command('render <control-plane-repo> <cluster-gitops-repo>')
  .action(renderCommand);
