import {Command} from 'commander';
import {assignCommand} from './commands/assign';

export const program = new Command();

program.command('assign <control-plane-repo>').action(assignCommand);
