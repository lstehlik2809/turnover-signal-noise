'use strict';
// Reproduce the accompanying post from the same pure model embedded in the app.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const model = require('./model-loader.cjs');
const rounds = Number(process.argv[2] || 100000);
if (!Number.isInteger(rounds) || rounds < 1) throw new Error('Round count must be a positive integer');
const N = 1000, p = 0.1, seed = 20260928;
const started = performance.now();
const result = model.longRun(N, p, rounds, seed);
const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const modelSource = html.match(/<script id="turnover-model">([\s\S]*?)<\/script>/)[1];
const exact = model.createModel(N, p);
const output = {
  description: 'Publication benchmark: independent generated rounds; 12 baseline and 24 test months; change probability 0.5; change month uniform 7–18; relative shift uniform 25–60%, equal directions.',
  N, p, seed, rounds, modelSha256: crypto.createHash('sha256').update(modelSource).digest('hex'),
  elapsedMs: Math.round(performance.now() - started),
  annualBandPct: [exact.shared.lo / N * 100, exact.shared.hi / N * 100],
  exactViews: Object.fromEntries(Object.entries(exact.views).map(([key, v]) => [key, {
    sdPercentagePoints: v.sdU / N * 100,
    outsideAnnualBand: v.pOutShared, outsideOwnBand: v.pOutOwn,
    expectedFlaggedReadingsPerYear: v.perYear * v.pOutShared
  }])),
  result
};
const destination = path.join(__dirname, '..', 'benchmark-results.json');
fs.writeFileSync(destination, JSON.stringify(output, null, 2) + '\n');
console.log(JSON.stringify(output, null, 2));
