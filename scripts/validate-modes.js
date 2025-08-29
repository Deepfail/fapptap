#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const MODES_PATH = path.resolve(__dirname, '..', '.github', 'MODES.yml');

function fail(msg) {
  console.error('MODES validation failed:', msg);
  process.exit(2);
}

function main() {
  if (!fs.existsSync(MODES_PATH)) fail(`${MODES_PATH} not found`);
  const yaml = fs.readFileSync(MODES_PATH, 'utf8');
  // Very small YAML parse without a dependency: look for required keys
  if (!/AUTO:/m.test(yaml)) fail('AUTO mode missing');
  if (!/trigger_header:\s*"mode: agent"/m.test(yaml)) fail('trigger_header missing or incorrect');
  if (!/response_mode:\s*final-only/m.test(yaml)) fail('response_mode: final-only missing for AUTO');
  console.log('MODES.yml looks good');
}

main();
