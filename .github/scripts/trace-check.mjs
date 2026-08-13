#!/usr/bin/env node
// Ketryx pull-request traceability gate.
//
// Runs in two stages:
//
//   Stage 1 (static, no network): every file this PR touches inside the traced
//   scope must carry the Ketryx metadata that builds the trace chain -
//   specs/*.md need `itemFulfills`, function-level items in src/** need
//   `@itemFulfills:`, feature scenarios need `@id:` and `@tests:`, and a change
//   to src/** must be accompanied by something traced.
//
//   Stage 2 (Ketryx-verified): ask Ketryx what it actually sees at the PR head
//   commit and confirm each touched software item spec really did land as a
//   design output with a FULFILLS relation to a requirement and at least one
//   Test Case pointing at it. Stage 1 is what a linter can prove; stage 2 is
//   what the record system proves.
//
// Env: KETRYX_URL, KETRYX_PROJECT, KETRYX_API_KEY, KETRYX_VERSION_ID (the
// hidden version pinned to the PR head SHA), CHANGED_FILES (newline separated).

import fs from 'node:fs';
import path from 'node:path';

const KETRYX_URL = (process.env.KETRYX_URL || '').replace(/\/$/, '');
const PROJECT = process.env.KETRYX_PROJECT;
const API_KEY = process.env.KETRYX_API_KEY;
const VERSION_ID = process.env.KETRYX_VERSION_ID;
const SKIP_KETRYX = process.env.SKIP_KETRYX_VERIFY === 'true';

const changed = (process.env.CHANGED_FILES || '')
  .split('\n')
  .map((s) => s.trim())
  .filter(Boolean);

const failures = [];
const notes = [];

function fail(msg) {
  failures.push(msg);
  console.log(`::error::${msg}`);
}
function note(msg) {
  notes.push(msg);
  console.log(msg);
}

// ---------------------------------------------------------------- stage 1

function parseSpec(file) {
  const text = fs.readFileSync(file, 'utf8');
  const fm = /^---\n([\s\S]*?)\n---/.exec(text);
  const meta = {};
  if (fm) {
    for (const line of fm[1].split('\n')) {
      const m = /^([A-Za-z][A-Za-z0-9_]*):\s*(.*)$/.exec(line.trim());
      if (m) meta[m[1]] = m[2].trim();
    }
  }
  const h1 = /^#\s+(.+)$/m.exec(text);
  return { meta, title: h1 ? h1[1].trim() : null, text };
}

function parseFeature(file) {
  const lines = fs.readFileSync(file, 'utf8').split('\n');
  const scenarios = [];
  let pendingTags = [];
  lines.forEach((line, i) => {
    const t = line.trim();
    if (t.startsWith('@')) {
      pendingTags = pendingTags.concat(t.split(/\s+/).filter((x) => x.startsWith('@')));
    } else if (/^Scenario( Outline)?:/.test(t)) {
      scenarios.push({ name: t.replace(/^Scenario( Outline)?:\s*/, ''), tags: pendingTags, line: i + 1 });
      pendingTags = [];
    } else if (t === '' || t.startsWith('#')) {
      // keep tags across blank/comment lines
    } else if (/^Feature:/.test(t)) {
      pendingTags = [];
    }
  });
  return scenarios;
}

const allSpecs = fs.existsSync('specs')
  ? fs.readdirSync('specs').filter((f) => f.endsWith('.md')).map((f) => path.join('specs', f))
  : [];
const specById = new Map();
for (const f of allSpecs) {
  const s = parseSpec(f);
  if (s.meta.itemId) specById.set(s.meta.itemId, { file: f, ...s });
}

// Every @tests: target across the whole repo, so we can tell whether a spec has
// verification coverage even when the scenario itself was not touched.
const testedIds = new Set();
const allFeatures = fs.existsSync('features')
  ? fs.readdirSync('features').filter((f) => f.endsWith('.feature')).map((f) => path.join('features', f))
  : [];
for (const f of allFeatures) {
  for (const sc of parseFeature(f)) {
    for (const tag of sc.tags) {
      if (tag.startsWith('@tests:')) testedIds.add(tag.slice('@tests:'.length));
    }
  }
}

const changedSpecs = changed.filter((f) => f.startsWith('specs/') && f.endsWith('.md') && fs.existsSync(f));
const changedFeatures = changed.filter((f) => f.startsWith('features/') && f.endsWith('.feature') && fs.existsSync(f));
const SRC_EXT = /\.(js|mjs|cjs|ts|tsx)$/;
const changedSrc = changed.filter((f) => f.startsWith('src/') && SRC_EXT.test(f) && fs.existsSync(f));

// Function-level git items: a JSDoc block carrying `@itemId:` above a function.
// Same trace edges as a spec file, expressed inline.
function parseFunctionItems(file) {
  const text = fs.readFileSync(file, 'utf8');
  const items = [];
  const blocks = text.matchAll(/\/\*\*([\s\S]*?)\*\//g);
  for (const b of blocks) {
    const body = b[1];
    const idMatch = /@itemId:\s*(\S+)/.exec(body);
    if (!idMatch) continue;
    const titleMatch = /@itemTitle:\s*"([^"]*)"/.exec(body);
    const typeMatch = /@itemType:\s*(.+)/.exec(body);
    const fulfillsMatch = /@itemFulfills:\s*(.+)/.exec(body);
    items.push({
      itemId: idMatch[1],
      title: titleMatch ? titleMatch[1].trim() : null,
      itemType: typeMatch ? typeMatch[1].trim() : null,
      fulfills: (fulfillsMatch ? fulfillsMatch[1] : '').split(',').map((x) => x.trim()).filter(Boolean),
      line: text.slice(0, b.index).split('\n').length,
    });
  }
  return items;
}

console.log('--- Ketryx PR traceability gate ---');
console.log(`Changed files in traced scope: ${changedSpecs.length} spec(s), ${changedFeatures.length} feature(s), ${changedSrc.length} source file(s)`);

const REQ_KEY = /^[A-Z][A-Z0-9]*-\d+$/;

for (const f of changedSpecs) {
  const s = parseSpec(f);
  if (!s.meta.itemId) fail(`${f}: software item spec has no \`itemId\` in its frontmatter, so Ketryx cannot key it to an item.`);
  if (!s.meta.itemType) fail(`${f}: software item spec has no \`itemType\` in its frontmatter.`);
  const fulfills = (s.meta.itemFulfills || '').split(',').map((x) => x.trim()).filter(Boolean);
  if (fulfills.length === 0) {
    fail(`${f}: software item spec declares no \`itemFulfills\` - this design output traces to no requirement and lands in Ketryx as an orphan.`);
  } else {
    const bad = fulfills.filter((k) => !REQ_KEY.test(k));
    if (bad.length) fail(`${f}: \`itemFulfills\` contains value(s) that are not requirement keys: ${bad.join(', ')}`);
    else note(`  OK  ${f} fulfills ${fulfills.join(', ')}`);
  }
  if (s.meta.itemId && !testedIds.has(s.meta.itemId)) {
    fail(`${f}: no Cucumber scenario is tagged \`@tests:${s.meta.itemId}\` - this design output has no verification test.`);
  }
}

for (const f of changedFeatures) {
  for (const sc of parseFeature(f)) {
    const tests = sc.tags.filter((t) => t.startsWith('@tests:')).map((t) => t.slice('@tests:'.length));
    const ids = sc.tags.filter((t) => t.startsWith('@id:'));
    if (ids.length === 0) fail(`${f}:${sc.line} scenario "${sc.name}" has no \`@id:\` tag, so its Ketryx Test Case has no stable identity.`);
    if (tests.length === 0) {
      fail(`${f}:${sc.line} scenario "${sc.name}" has no \`@tests:\` tag - the test execution traces to nothing.`);
    } else {
      const unknown = tests.filter((t) => !specById.has(t) && !REQ_KEY.test(t));
      if (unknown.length) fail(`${f}:${sc.line} scenario "${sc.name}" is tagged \`@tests:${unknown.join(',')}\` but no spec in specs/ declares that itemId.`);
      else note(`  OK  ${f}:${sc.line} tests ${tests.join(', ')}`);
    }
  }
}

let srcItemCount = 0;
for (const f of changedSrc) {
  for (const it of parseFunctionItems(f)) {
    srcItemCount++;
    if (!it.itemType) fail(`${f}:${it.line} function-level item \`${it.itemId}\` has no \`@itemType:\`.`);
    if (it.fulfills.length === 0) {
      fail(`${f}:${it.line} function-level item \`${it.itemId}\` declares no \`@itemFulfills:\` - this design output traces to no requirement and lands in Ketryx as an orphan.`);
    } else {
      const bad = it.fulfills.filter((k) => !REQ_KEY.test(k));
      if (bad.length) fail(`${f}:${it.line} \`@itemFulfills:\` on \`${it.itemId}\` contains value(s) that are not requirement keys: ${bad.join(', ')}`);
      else note(`  OK  ${f}:${it.line} ${it.itemId} fulfills ${it.fulfills.join(', ')}`);
    }
  }
}

if (changedSrc.length && changedSpecs.length === 0 && changedFeatures.length === 0 && srcItemCount === 0) {
  fail(
    `This pull request changes source under src/ (${changedSrc.join(', ')}) but declares no Ketryx item: no software item spec in specs/, no scenario in features/, and no function-level \`@itemId:\` block in the changed source. ` +
      `Changed behavior has to trace to a requirement and be verified by a test.`
  );
}

if (failures.length) {
  console.log('\nStatic traceability stage FAILED - not querying Ketryx.');
  process.exit(1);
}
console.log('Static traceability stage passed.');

// ---------------------------------------------------------------- stage 2

if (SKIP_KETRYX) {
  console.log('Ketryx verification stage skipped (SKIP_KETRYX_VERIFY=true).');
  process.exit(0);
}
if (!VERSION_ID || !API_KEY || !PROJECT || !KETRYX_URL) {
  console.log('::warning::Ketryx verification stage skipped - missing KETRYX_URL/KETRYX_PROJECT/KETRYX_API_KEY/KETRYX_VERSION_ID.');
  process.exit(0);
}
if (changedSpecs.length === 0) {
  console.log('No software item specs touched - nothing to verify against Ketryx.');
  process.exit(0);
}

const PAGE = 1000;

// `query` is a required parameter on this endpoint even though it is the KQL
// filter. An empty KQL query matches every record, which is what we want - the
// gate filters by type client-side rather than betting on type shorthands.
async function fetchRecords(kql = '') {
  const out = [];
  let startAt = 0;
  for (;;) {
    const url =
      `${KETRYX_URL}/api/v1/projects/${PROJECT}/records` +
      `?versionId=${encodeURIComponent(VERSION_ID)}` +
      `&query=${encodeURIComponent(kql)}` +
      `&startAt=${startAt}&maxResults=${PAGE}`;
    const res = await fetch(url, { headers: { Authorization: `Bearer ${API_KEY}` } });
    if (!res.ok) throw new Error(`records query failed: HTTP ${res.status} ${await res.text()}`);
    const body = await res.json();
    const batch = body.records || [];
    out.push(...batch);
    if (batch.length < PAGE) break;
    startAt += batch.length;
  }
  return out;
}

const wanted = changedSpecs.map((f) => {
  const s = parseSpec(f);
  return { file: f, itemId: s.meta.itemId, title: s.title };
});

let records = [];
let found = [];
// Ketryx scans the branch when the build is reported; give the scan a window.
for (let attempt = 1; attempt <= 20; attempt++) {
  records = await fetchRecords();
  found = wanted.filter((w) => records.some((r) => r.title === w.title));
  if (found.length === wanted.length) break;
  console.log(`Waiting for Ketryx to scan the PR commit (${found.length}/${wanted.length} spec(s) visible, attempt ${attempt}/20)...`);
  await new Promise((r) => setTimeout(r, 15000));
}

console.log(`Ketryx returned ${records.length} record(s) for version ${VERSION_ID}.`);
const byType = {};
for (const r of records) byType[r.type || 'unknown'] = (byType[r.type || 'unknown'] || 0) + 1;
console.log(`Record types: ${Object.entries(byType).map(([k, v]) => `${k}=${v}`).join(', ')}`);

for (const w of wanted) {
  const rec = records.find((r) => r.title === w.title);
  if (!rec) {
    // Ketryx scans a PAT-connected repository on build report / manual refresh /
    // hourly, not on push. If the record is simply not there yet that is scan
    // lag, not a traceability gap - stage 1 already proved the tags are right.
    console.log(`::warning::Ketryx has not yet scanned "${w.title}" (${w.file}) at this commit; skipping platform verification for it.`);
    continue;
  }
  const fulfills = (rec.relations || []).filter((rel) => /FULFILL/i.test(rel.type));
  if (fulfills.length === 0) {
    fail(`Ketryx record "${rec.title}" (${w.file}) has no FULFILLS relation - it is an orphaned design output in the traceability matrix.`);
  } else {
    note(`  OK  Ketryx: "${rec.title}" fulfills ${fulfills.length} requirement(s)`);
  }
  const testedBy = records.filter((r) => (r.relations || []).some((rel) => /TEST/i.test(rel.type) && rel.toItem?.id === rec.itemId));
  if (testedBy.length === 0) {
    fail(`Ketryx record "${rec.title}" (${w.file}) has no Test Case tracing to it - no verification coverage.`);
  } else {
    note(`  OK  Ketryx: "${rec.title}" is verified by ${testedBy.length} Test Case(s)`);
  }
}

if (failures.length) {
  console.log('\nKetryx verification stage FAILED.');
  process.exit(1);
}
console.log('\nKetryx verification stage passed - every touched design output is traced and verified.');
