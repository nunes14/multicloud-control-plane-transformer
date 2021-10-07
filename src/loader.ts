import {promises as fs} from 'fs';
import * as path from 'path';
import * as yaml from 'js-yaml';

import {Schema} from 'ajv';
import Ajv2020 from 'ajv/dist/2020';
const ajv = new Ajv2020();

export async function loadAll<T>(dir: string, schema?: Schema): Promise<T[]> {
  const items: T[] = [];
  for (const child of await fs.readdir(dir, {withFileTypes: true})) {
    if (!child.isFile()) {
      continue;
    }

    const absPath = path.join(dir, child.name);
    const item = await load<T>(absPath, schema);
    items.push(item);
  }
  return items;
}

export async function load<T>(filePath: string, schema?: Schema): Promise<T> {
  const isValid = schema ? ajv.compile(schema) : () => true;
  const text = await fs.readFile(filePath, 'utf8');
  const item = yaml.load(text) as T;
  if (!isValid(item)) {
    throw new Error(`Invalid entity: ${JSON.stringify(item)}`);
  }
  return item;
}
