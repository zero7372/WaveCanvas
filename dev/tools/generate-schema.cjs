const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const root = path.resolve(__dirname, '..', '..', 'app');
const source = fs.readFileSync(path.join(root, 'project.json'), 'utf8');
const properties = JSON.parse(source).general.properties;
const hash = crypto.createHash('sha256').update(source).digest('hex');
const output = '// Generated from project.json. Do not edit; run node scripts/generate-schema.cjs.\n'
    + 'window.VisualizerPropertySchema = ' + JSON.stringify({ sourceHash: hash, properties }, null, 2) + ';\n';
const target = path.join(root, 'property-schema.js');
if (process.argv.includes('--check')) {
    if (!fs.existsSync(target) || fs.readFileSync(target, 'utf8') !== output) {
        console.error('property-schema.js is out of date. Run node dev/tools/generate-schema.cjs.');
        process.exitCode = 1;
    } else {
        console.log('Schema matches project.json: ' + Object.keys(properties).length + ' properties.');
    }
} else {
    fs.writeFileSync(target, output);
}
