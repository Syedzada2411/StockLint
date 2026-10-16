import test from "node:test";
import assert from "node:assert/strict";
import { parseCSV, guessMapping, analyze, cleanedCSV, reportCSV, stringifyCSV } from "../src/core.js";

test("quoted commas, escaped quotes, CRLF and embedded newline round-trip", () => {
  const text = 'SKU,Name,Stock,Price\r\nA-1,"Mug, ""blue""\nlarge",2,5.00\r\n';
  const parsed = parseCSV(text);
  assert.equal(parsed.data[0].cells[1], 'Mug, "blue"\nlarge');
  assert.equal(parsed.data[0].line, 2);
  assert.equal(parseCSV(text + 'B-2,Chair,1,7.00\r\n').data[1].line, 4);
  assert.deepEqual(parseCSV(stringifyCSV([parsed.headers, ...parsed.data.map(r => r.cells)])).data[0].cells, parsed.data[0].cells);
});

test("audit catches both duplicate SKU rows and invalid values without fabricating fixes", () => {
  const parsed = parseCSV('SKU,Name,Stock,Price\n X1 , Lamp ,-1,10\nx1,Lamp B,2,free\n');
  const result = analyze(parsed, guessMapping(parsed.headers));
  assert.equal(result.summary.rows, 2);
  assert.equal(result.summary.changed, 2);
  assert.equal(result.issues.filter(i => i.field === "SKU").length, 2);
  assert.equal(result.issues.filter(i => i.field === "Stock quantity").length, 1);
  assert.equal(result.issues.filter(i => i.field === "Unit price").length, 1);
  assert.match(cleanedCSV(result), /X1,Lamp,'-1,10/);
});

test("uneven rows block cleaned export and formula-like cells are neutralized in reports", () => {
  const parsed = parseCSV('SKU,Name,Stock,Price\nA,Chair,1\n');
  const result = analyze(parsed, guessMapping(parsed.headers));
  assert.throws(() => cleanedCSV(result), /uneven column counts/);
  const second = analyze(parseCSV('SKU,Name,Stock,Price\nA,"=HYPERLINK(""x"")",1,2\n'), { sku: 0, name: 1, stock: 2, price: 3 });
  assert.match(cleanedCSV(second), /'=HYPERLINK/);
  assert.match(reportCSV({ issues: [{severity:"Error",line:2,field:"SKU",message:"=evil"}],changes:[] }), /'=evil/);
});

test("malformed quotes and duplicate headers fail with clear errors", () => {
  assert.throws(() => parseCSV('SKU,Name\nA,"unfinished'), /Unclosed/);
  assert.throws(() => parseCSV('SKU, sku\nA,B'), /Duplicate column/);
});
