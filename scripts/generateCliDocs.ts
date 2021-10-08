import * as fs from 'fs';
import {Command} from 'commander';
import {program} from '../src/cli';

function getCommandDocs(command: Command, help: string[] = []): string[] {
  let commandDocs = '';
  if (command.name()) {
    commandDocs += `## ${command.name()}\n\n`;
  }
  commandDocs += codeBlock(command.helpInformation());

  help.push(commandDocs);
  for (const sub of command.commands) {
    getCommandDocs(sub, help);
  }
  return help;
}

function codeBlock(code: string): string {
  return `\`\`\`shell\n${code}\n\`\`\``;
}

const header = '# Commands';

const docs = [header, ...getCommandDocs(program)].join('\n\n');
if (!fs.existsSync('docs')) {
  fs.mkdirSync('docs');
}
fs.writeFileSync('docs/COMMANDS.md', docs);
