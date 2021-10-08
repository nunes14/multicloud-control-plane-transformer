import {exit} from 'process';
import {program} from './cli';
import {Logger} from './logger';

(async function main() {
  try {
    await program.parseAsync();
  } catch (err) {
    Logger.error(err);
    exit(1);
  }
})();
