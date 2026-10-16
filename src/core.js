export const REQUIRED = ["sku", "name", "stock", "price"];
export const LABELS = { sku: "SKU", name: "Product name", stock: "Stock quantity", price: "Unit price" };

export function parseCSV(input) {
  const text = input.replace(/^\uFEFF/, "");
  const rows = [];
  let row = [], field = "", quoted = false, afterQuote = false, physicalLine = 1, rowStart = 1;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (c === '"') { quoted = false; afterQuote = true; }
      else { field += c; if (c === "\n" || (c === "\r" && text[i + 1] !== "\n")) physicalLine++; }
    } else if (afterQuote) {
      if (c === ",") { row.push(field); field = ""; afterQuote = false; }
      else if (c === "\n" || c === "\r") {
        row.push(field); rows.push({ cells: row, line: rowStart }); row = []; field = ""; afterQuote = false; physicalLine++; rowStart = physicalLine;
        if (c === "\r" && text[i + 1] === "\n") i++;
      } else if (c !== " " && c !== "\t") throw new Error(`Unexpected character after closing quote near position ${i + 1}.`);
    } else if (c === '"') {
      if (field !== "") throw new Error(`Unexpected quote near position ${i + 1}.`);
      quoted = true;
    } else if (c === ",") { row.push(field); field = ""; }
    else if (c === "\n" || c === "\r") {
      row.push(field); rows.push({ cells: row, line: rowStart }); row = []; field = ""; physicalLine++; rowStart = physicalLine;
      if (c === "\r" && text[i + 1] === "\n") i++;
    } else field += c;
  }
  if (quoted) throw new Error("Unclosed quoted field. Check the CSV file.");
  if (field !== "" || row.length || afterQuote) { row.push(field); rows.push({ cells: row, line: rowStart }); }
  if (!rows.length) throw new Error("The CSV is empty.");
  const headers = rows.shift().cells;
  if (headers.every(h => !h.trim())) throw new Error("The header row is empty.");
  if (new Set(headers.map(h => h.trim().toLowerCase())).size !== headers.length) throw new Error("Duplicate column headers. Rename them in the source file.");
  const data = rows.filter(r => r.cells.some(c => c.trim() !== ""));
  return { headers, data };
}

export function guessMapping(headers) {
  const patterns = {
    sku: [/^sku$/i, /^item[ _-]?(code|sku)$/i, /^product[ _-]?(sku|code|id)$/i],
    name: [/^(product[ _-]?)?name$/i, /^title$/i, /^item[ _-]?name$/i],
    stock: [/^(stock|quantity|qty|inventory|on[ _-]?hand)$/i, /^stock[ _-]?(qty|quantity)$/i],
    price: [/^(unit[ _-]?)?price$/i, /^selling[ _-]?price$/i]
  };
  return Object.fromEntries(REQUIRED.map(key => [key, headers.findIndex(h => patterns[key].some(p => p.test(h.trim())))]));
}

export function analyze(parsed, mapping) {
  const indexes = REQUIRED.map(k => mapping[k]);
  if (indexes.some(i => !Number.isInteger(i) || i < 0 || i >= parsed.headers.length) || new Set(indexes).size !== indexes.length)
    throw new Error("Map each required field to a different column.");
  const issues = [], changes = [], rows = [], skuLines = new Map();
  const issue = (line, field, severity, message) => issues.push({ line, field, severity, message });
  for (const entry of parsed.data) {
    const { line } = entry;
    if (entry.cells.length !== parsed.headers.length) {
      issue(line, "Row", "Error", `Expected ${parsed.headers.length} columns; found ${entry.cells.length}.`);
    }
    const cells = [...entry.cells];
    for (const key of REQUIRED) {
      const index = mapping[key], original = cells[index] ?? "", trimmed = original.trim();
      if (trimmed !== original) {
        changes.push({ line, field: LABELS[key], before: original, after: trimmed, action: "Trim outer whitespace" });
        if (index < cells.length) cells[index] = trimmed;
      }
    }
    const sku = (cells[mapping.sku] ?? "").trim();
    const name = (cells[mapping.name] ?? "").trim();
    const stock = (cells[mapping.stock] ?? "").trim();
    const price = (cells[mapping.price] ?? "").trim();
    if (!sku) issue(line, "SKU", "Error", "Missing SKU.");
    if (!name) issue(line, "Product name", "Error", "Missing product name.");
    if (!/^(0|[1-9]\d*)$/.test(stock)) issue(line, "Stock quantity", "Error", "Use a non-negative whole number without separators.");
    if (!/^(0|[1-9]\d*)(?:\.\d{1,2})?$/.test(price)) issue(line, "Unit price", "Error", "Use a non-negative number with up to two decimal places.");
    if (sku) {
      const canonical = sku.toLocaleLowerCase("en-US");
      if (skuLines.has(canonical)) {
        issue(line, "SKU", "Error", `Duplicate SKU; first seen on line ${skuLines.get(canonical)}.`);
        issue(skuLines.get(canonical), "SKU", "Error", `Duplicate SKU; repeated on line ${line}.`);
      } else skuLines.set(canonical, line);
    }
    rows.push({ line, cells });
  }
  return { headers: parsed.headers, rows, issues, changes,
    summary: { rows: rows.length, errors: issues.length, changed: changes.length, affected: new Set(issues.map(i => i.line)).size } };
}

// Apostrophes prevent spreadsheet software from interpreting user text as a formula.
export function escapeSpreadsheetFormula(value) {
  const s = String(value ?? "");
  return /^[\s\u0000-\u001f]*[=+\-@]/.test(s) ? "'" + s : s;
}

export function stringifyCSV(rows) {
  return rows.map(row => row.map(cell => {
    const safe = escapeSpreadsheetFormula(cell);
    return /[",\r\n]/.test(safe) ? '"' + safe.replaceAll('"', '""') + '"' : safe;
  }).join(",")).join("\r\n") + "\r\n";
}

export function cleanedCSV(result) {
  if (result.issues.some(i => i.field === "Row")) throw new Error("Fix uneven column counts before CSV export; no rows were discarded.");
  return stringifyCSV([result.headers, ...result.rows.map(r => r.cells)]);
}

export function reportCSV(result) {
  return stringifyCSV([["Type", "CSV line", "Field", "Details", "Before", "After"],
    ...result.issues.map(i => [i.severity, i.line, i.field, i.message, "", ""]),
    ...result.changes.map(c => ["Change", c.line, c.field, c.action, c.before, c.after])]);
}
