import fs from 'node:fs';
import path from 'node:path';

const root = fs.realpathSync('.');
const source = path.join(root, 'public');
const destination = path.join(root, '한걸음', 'travel-app', 'dist');
if (!fs.statSync(source).isDirectory() || !fs.statSync(destination).isDirectory() ||
    path.relative(root, destination).startsWith('..')) {
  throw Error('Run from the integrated repository root with both UI directories present.');
}
fs.cpSync(source, destination, {recursive: true, force: true});
console.log('Copied public UI into the local preview directory.');
