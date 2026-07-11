#!/usr/bin/env node
// Lanceur de tests MIENRA — sans dépendance : `node tests/run.js`
const fs = require("fs");
const path = require("path");
const { loadApp, makeT } = require("./harness");

const files = fs.readdirSync(__dirname).filter((f) => f.endsWith(".test.js")).sort();
let total = 0, failed = 0;

for (const file of files) {
  const suite = require(path.join(__dirname, file));
  const t = makeT();
  try {
    suite(loadApp(), t); // instance FRAÎCHE de l'app par suite
  } catch (e) {
    console.log(`\n✗ ${file} : erreur d'exécution — ${e && e.message}`);
    failed++;
    continue;
  }
  total += t.count;
  if (t.failures.length) {
    failed += t.failures.length;
    console.log(`\n✗ ${file}`);
    t.failures.forEach((name) => console.log(`   - ${name}`));
  } else {
    console.log(`✓ ${file} (${t.count} assertions)`);
  }
}

console.log(`\n${total - failed}/${total} assertions réussies` + (failed ? ` — ${failed} échec(s)` : " — tout est vert ✅"));
process.exit(failed ? 1 : 0);
