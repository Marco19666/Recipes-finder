import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const html = readFileSync("public/index.html", "utf8");
const js = readFileSync("public/salvasoldi.js", "utf8");
const worker = readFileSync("src/entry.py", "utf8");
const sw = readFileSync("public/sw.js", "utf8");

const htmlIds = new Set([...html.matchAll(/id="([^"]+)"/g)].map((m) => m[1]));
const jsIds = [...js.matchAll(/ids\\("([^"]+)"\\)/g)].map((m) => m[1]);
const missing = [...new Set(jsIds)].filter((id) => !htmlIds.has(id));
assert.deepEqual(missing, [], `SalvaSoldi JS references missing HTML ids: ${missing.join(", ")}`);

for (const id of [
  "salvasoldi-section", "show-salvasoldi", "budget-form", "cost-form",
  "budget-per-person", "budget-people", "budget-diet", "cost-menu",
  "cost-people", "salvasoldi-results", "salvasoldi-status"
]) assert.ok(htmlIds.has(id), `Missing required SalvaSoldi element: ${id}`);

assert.ok(worker.includes('@app.post("/api/salvasoldi")'), "Worker endpoint is missing");
assert.ok(js.includes('fetch("/api/salvasoldi"'), "Frontend does not call the SalvaSoldi endpoint");
assert.ok(sw.includes("salvasoldi.js?v="), "Service worker cache does not include SalvaSoldi");
assert.ok(html.includes("salvasoldi.js?v="), "HTML does not load SalvaSoldi");
console.log("SalvaSoldi UI/API contract checks passed.");
