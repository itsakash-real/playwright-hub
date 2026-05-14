

const fs = require('fs');
const path = require('path');

function loadFixture(relativePath) {
  const absolutePath = path.resolve(process.cwd(), relativePath);

  if (!fs.existsSync(absolutePath)) {
    throw new Error(
      `jsonLoader: Fixture file not found: ${absolutePath}\n` +
        `Relative path provided: ${relativePath}\n` +
        `Working directory: ${process.cwd()}`
    );
  }

  let raw;
  try {
    // Read the file as a UTF-8 string.
    raw = fs.readFileSync(absolutePath, 'utf-8');
  } catch (err) {
    throw new Error(`jsonLoader: Could not read file ${absolutePath}: ${err.message}`);
  }

  let parsed;
  try {
    // Parse the JSON string into a JavaScript object.
    parsed = JSON.parse(raw);
  } catch (err) {
    throw new Error(
      `jsonLoader: Invalid JSON in ${absolutePath}\n` +
        `Parse error: ${err.message}\n` +
        `Hint: Check for trailing commas — they're not valid in JSON.`
    );
  }

  return JSON.parse(JSON.stringify(parsed));
}

function loadFixtureKey(relativePath, key) {
  const data = loadFixture(relativePath);

  if (!(key in data)) {
    throw new Error(
      `jsonLoader: Key "${key}" not found in ${relativePath}\n` +
        `Available keys: ${Object.keys(data).join(', ')}`
    );
  }

  return data[key];
}

module.exports = { loadFixture, loadFixtureKey };