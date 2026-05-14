

const fs = require('fs');
const path = require('path');
const { parse } = require('csv-parse/sync');

function parseCSV(relativePath) {
  const absolutePath = path.resolve(process.cwd(), relativePath);

  if (!fs.existsSync(absolutePath)) {
    throw new Error(
      `csvParser: Fixture file not found: ${absolutePath}\n` +
        `Relative path provided: ${relativePath}`
    );
  }

  let raw;
  try {
    raw = fs.readFileSync(absolutePath, 'utf-8');
  } catch (err) {
    throw new Error(`csvParser: Could not read file ${absolutePath}: ${err.message}`);
  }

  try {
    const records = parse(raw, {
      // columns: true means "use the first row as column names (keys)"
      // Without this, each row is an array of strings instead of an object
      columns: true,

      // skip_empty_lines: true ignores blank lines in the CSV.
      // Useful for files that have a trailing newline (most text editors add one)
      skip_empty_lines: true,

      // trim: true removes leading and trailing whitespace from each field.
      // Handles cases like: "name, price" (space after comma)
      trim: true,

      // bom: true strips the BOM character (U+FEFF) that Excel adds to CSV exports.
      // Without this, the first column header would be "\uFEFFname" instead of "name"
      bom: true,

      // relax_column_count: false (default) — throw if a row has different
      // column count than the header. Catches malformed CSV immediately.
      relax_column_count: false,
    });

    return records;
  } catch (err) {
    throw new Error(
      `csvParser: Failed to parse CSV at ${absolutePath}\n` +
        `Parse error: ${err.message}\n` +
        `Hint: Check that column count is consistent across all rows.`
    );
  }
}

function parseCSVWithTypes(relativePath, numericColumns = []) {
  const records = parseCSV(relativePath);

  return records.map((record) => {
    const typed = { ...record };
    for (const col of numericColumns) {
      if (col in typed) {
        typed[col] = parseFloat(typed[col]);
      }
    }
    return typed;
  });
}

module.exports = { parseCSV, parseCSVWithTypes };