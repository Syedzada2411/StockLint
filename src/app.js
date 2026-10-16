import { REQUIRED, LABELS, parseCSV, guessMapping, analyze, cleanedCSV, reportCSV } from "./core.js";

const $ = id => document.getElementById(id);
let parsed, result, sourceName = "inventory.csv";
const message = (text) => { $("message").textContent = text; $("message").hidden = !text; };
function download(content, filename) {
  const blob = new Blob(["\uFEFF", content], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob), anchor = document.createElement("a");
  anchor.href = url; anchor.download = filename; document.body.append(anchor); anchor.click(); anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function cell(row, value) { const td = row.insertCell(); td.textContent = String(value); return td; }
function fillTable(id, entries, render, emptyText) {
  const body = $(id); body.replaceChildren();
  if (!entries.length) { const tr = body.insertRow(); const td = cell(tr, emptyText); td.colSpan = 3; td.className = "empty"; return; }
  for (const entry of entries.slice(0, 200)) render(body.insertRow(), entry);
}
function showResult() {
  $("analysis").hidden = false;
  for (const [key, value] of Object.entries({ rows: result.summary.rows, affected: result.summary.affected, issues: result.summary.errors, changes: result.summary.changed })) $("metric-" + key).textContent = value;
  const malformed = result.issues.some(i => i.field === "Row");
  $("review-note").textContent = malformed ? "Some rows have the wrong number of columns. Fix those in the source CSV before exporting a reviewed file. The audit log is available." : result.issues.length ? "Issues still need a human review. The downloaded CSV only trims outer whitespace in mapped fields; it does not resolve duplicates or invalid values." : "No issues found in the selected columns. Review the audit log for any whitespace changes.";
  $("review-note").classList.toggle("good", !result.issues.length);
  $("download-clean").disabled = malformed;
  $("issue-count").textContent = `${result.issues.length} total${result.issues.length > 200 ? " · first 200 shown" : ""}`;
  $("change-count").textContent = `${result.changes.length} total${result.changes.length > 200 ? " · first 200 shown" : ""}`;
  fillTable("issue-body", result.issues, (tr,i) => { cell(tr,i.line); cell(tr,i.field); cell(tr,i.message); }, "No issues found.");
  fillTable("change-body", result.changes, (tr,c) => { cell(tr,c.line); cell(tr,c.field); cell(tr,JSON.stringify(c.before) + " → " + JSON.stringify(c.after)); }, "No whitespace changes made.");
  $("analysis").scrollIntoView({ behavior: "smooth", block: "start" });
}
function load(text, name) {
  try {
    if (new Blob([text]).size > 5 * 1024 * 1024) throw new Error("Use a CSV smaller than 5 MB.");
    parsed = parseCSV(text);
    if (parsed.data.length > 20000) throw new Error("Use a CSV with at most 20,000 data rows.");
    sourceName = name; result = null; $("analysis").hidden = true; $("results").hidden = false;
    $("file-label").textContent = `${name} · ${parsed.data.length} data rows · ${parsed.headers.length} columns`;
    const suggested = guessMapping(parsed.headers), fields = $("mapping-fields"); fields.replaceChildren();
    for (const key of REQUIRED) {
      const label = document.createElement("label"); label.textContent = LABELS[key];
      const select = document.createElement("select"); select.id = "map-" + key;
      select.append(new Option("Select a column", ""));
      parsed.headers.forEach((header, index) => select.append(new Option(`${header || "(unnamed)"} · column ${index+1}`, String(index))));
      select.value = suggested[key] < 0 ? "" : String(suggested[key]); label.append(select); fields.append(label);
    }
    message(""); $("results").scrollIntoView({ behavior: "smooth", block: "start" });
  } catch (error) { parsed = null; $("results").hidden = true; message(error.message); }
}
async function handleFile(file) {
  if (!file) return;
  if (file.size > 5 * 1024 * 1024) { message("Use a CSV smaller than 5 MB."); return; }
  try { load(await file.text(), file.name); } catch { message("Could not read that file."); }
}
$("file-input").addEventListener("change", e => handleFile(e.target.files[0]));
const dropzone = $("dropzone");
for (const event of ["dragenter", "dragover"]) dropzone.addEventListener(event, e => { e.preventDefault(); dropzone.classList.add("drag"); });
for (const event of ["dragleave", "drop"]) dropzone.addEventListener(event, e => { e.preventDefault(); dropzone.classList.remove("drag"); });
dropzone.addEventListener("drop", e => handleFile(e.dataTransfer.files[0]));
async function loadSample() {
  try { const response = await fetch("./sample/inventory-demo.csv"); if (!response.ok) throw new Error(); load(await response.text(), "fictional-inventory-demo.csv"); }
  catch { message("Sample could not load. Run this app through a local web server."); }
}
$("sample").addEventListener("click", loadSample); $("sample-top").addEventListener("click", loadSample);
$("run-check").addEventListener("click", () => {
  if (!parsed) return;
  try { result = analyze(parsed, Object.fromEntries(REQUIRED.map(key => [key, $("map-" + key).value === "" ? -1 : Number($("map-" + key).value)]))); message(""); showResult(); }
  catch (error) { message(error.message); }
});
$("download-clean").addEventListener("click", () => { if (result) download(cleanedCSV(result), sourceName.replace(/\.csv$/i, "") + "-reviewed.csv"); });
$("download-report").addEventListener("click", () => { if (result) download(reportCSV(result), sourceName.replace(/\.csv$/i, "") + "-audit-log.csv"); });
