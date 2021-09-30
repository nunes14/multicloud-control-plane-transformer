import {Command} from 'commander';

const program = new Command();

program
  .command('transform <control-plane-repo> <output-folder>')
  .action((controlPlaneRepo: string, outputFolder: string) => {
    console.log('Hello, Transformer!');
    console.log(`Control Plane Repo Path: ${controlPlaneRepo}`);
    console.log(`Output Folder Path: ${outputFolder}`);
  });

program.parse(process.argv);
