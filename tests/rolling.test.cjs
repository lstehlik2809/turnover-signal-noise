'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const html = fs.readFileSync(path.join(__dirname, '../index.html'), 'utf8');
// Exercise the presentation helper without changing/exporting the statistical model.
const source = html.match(/function rollingTestRates\(X, N\)\{[\s\S]*?\n\}/)[0];
const rolling = new Function(`${source}; return rollingTestRates;`)();

test('rolling windows use actual trailing counts: baseline 2–12 plus test 1, then test 13–24', () => {
  const counts = Array.from({length:36}, (_, k) => k + 1);
  const original = [...counts];
  const rates = rolling(counts, 1000);
  assert.equal(rates.length, 24);
  assert.equal(rates[0], 90 / 1000); // 2 + ... + 13
  assert.equal(rates[11], 222 / 1000); // 13 + ... + 24
  assert.equal(rates[23], 366 / 1000); // 25 + ... + 36
  assert.deepEqual(counts, original);
  const futureChanged = [...counts]; futureChanged[35] = 1000;
  assert.deepEqual(rolling(futureChanged, 1000).slice(0, 23), rates.slice(0, 23));
  assert.equal(rolling(counts, 2000)[0], rates[0] / 2);
});

test('sustained step expectation responds immediately and fully after 12 changed months in either direction', () => {
  for (const next of [5, 15]) {
    // Counts equal their monthly expectations here; this fixture is not a random trajectory.
    const rates = rolling([...Array(18).fill(10), ...Array(18).fill(next)], 1000);
    assert.equal(rates[5], .12);
    for (let changed = 1; changed <= 12; changed++) {
      assert.equal(rates[5 + changed], ((12 - changed) * 10 + changed * next) / 1000);
    }
    assert.equal(rates[23], 12 * next / 1000);
  }
});

test('observed rolling path can reverse despite a sustained underlying step; zero-range baseline remains usable', () => {
  const rates = rolling([...Array(12).fill(10), 20, 0, ...Array(22).fill(15)], 1000);
  assert.equal(rates[0], .13); assert.equal(rates[1], .12);
  assert.deepEqual(rolling(Array(36).fill(0), 50), Array(24).fill(0));
  assert.deepEqual(rolling(Array(36).fill(1), 50), Array(24).fill(.24));
});

test('statistical model remains identical to the reproducible publication model', () => {
  const script = html.match(/<script id="turnover-model">([\s\S]*?)<\/script>/)[1];
  const published = require('../benchmark-results.json');
  // Publication was generated from a Windows checkout; normalize to its CRLF convention.
  assert.equal(crypto.createHash('sha256').update(script.replace(/\r?\n/g, '\r\n')).digest('hex'), published.modelSha256);
});
