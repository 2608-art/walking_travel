// Load the browser's UMD engine without changing the repository's ESM package type.
// Keep legacy Node checks pointed at the canonical source, not a build copy.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const filename = path.join(__dirname, '../public/route-engine.js');
const sandbox = {module: {exports: {}}, console};
vm.runInNewContext(fs.readFileSync(filename, 'utf8'), sandbox, {filename});
module.exports = sandbox.module.exports;
