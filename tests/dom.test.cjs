'use strict';
// DOM/event integration only: this does not render pixels or test a screen reader.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { JSDOM, VirtualConsole } = require(require.resolve('jsdom', {
  paths: [process.cwd(), path.join(os.tmpdir(), 'turnover-audit-tools')]
}));
const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const errors = [];
const virtualConsole = new VirtualConsole();
virtualConsole.on('jsdomError', e => errors.push(e));
const raf = new Map();
let rafId = 0;
const explainerSeenKey = 'turnover-noise-explainer-seen-v1';
function setupWindow(w) {
  w.matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {} });
  w.ResizeObserver = class { observe() {} disconnect() {} };
  w.requestAnimationFrame = cb => { raf.set(++rafId, cb); return rafId; };
  w.cancelAnimationFrame = id => raf.delete(id);
  w.HTMLCanvasElement.prototype.getContext = () => new Proxy({}, {
    get: (_, key) => key === 'measureText' ? text => ({ width: String(text).length * 7 }) : () => {},
    set: () => true
  });
  w.HTMLElement.prototype.getBoundingClientRect = () => ({ width: 400, height: 196, top: 0, left: 0, right: 400, bottom: 196 });
  w.HTMLDialogElement.prototype.showModal = function () { this.open = true; };
  w.HTMLDialogElement.prototype.close = function () { this.open = false; };
}
const dom = new JSDOM(html, {
  url: 'https://turnover.test/', // Origin for localStorage; no resources are fetched.
  runScripts: 'dangerously', virtualConsole, pretendToBeVisual: true,
  beforeParse: setupWindow
});
const w = dom.window, doc = w.document;
const el = id => { const node = doc.getElementById(id); assert.ok(node, `Missing #${id}`); return node; };
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
const until = async (predicate, message) => {
  for (let i = 0; i < 500; i++) { if (predicate()) return; await wait(10); }
  assert.fail(message);
};
const input = (id, value) => { el(id).value = value; el(id).dispatchEvent(new w.Event('input', { bubbles: true })); };
const key = (node, value, code = value) => node.dispatchEvent(new w.KeyboardEvent('keydown', { key: value, code, bubbles: true, cancelable: true }));
const frame = t => { const pending = [...raf.values()]; raf.clear(); pending.forEach(cb => cb(t)); };

(async () => {
  try {
    assert.equal(errors.length, 0, errors.map(String).join('\n'));
    assert.equal(el('explainer').open, true, 'Explainer opens on first visit');
    assert.equal(w.localStorage.getItem(explainerSeenKey), '1', 'First visit is remembered');
    el('closeExplainer').click();
    assert.ok(el('gameChartBox').querySelector('svg'), 'Game chart initializes');
    const ids = [...doc.querySelectorAll('[id]')].map(node => node.id);
    assert.equal(new Set(ids).size, ids.length, 'IDs are unique');
    assert.equal(el('resultPane').hidden, true);
    assert.ok(doc.querySelector('.game details table'), 'Observed chart data have an accessible table');
    assert.equal(doc.querySelector('.game details table tbody').rows.length, 36);
    assert.doesNotMatch(doc.querySelector('.game details table').textContent, /true rate|change starts/i);

    doc.body.focus(); key(doc.body, 'y');
    assert.equal(el('resultPane').hidden, true, 'Unrelated Y key does not answer');
    el('headcount').focus(); key(el('headcount'), 'n');
    assert.equal(el('resultPane').hidden, true, 'Slider keyboard does not answer');
    const answer = doc.querySelector('#choices button'); answer.focus(); key(answer, 'y');
    assert.equal(el('resultPane').hidden, false, 'Answer-scoped keyboard works');
    assert.equal(el('scoreboard').hidden, false);
    assert.equal(doc.activeElement, el('nextBtn'));
    el('nextBtn').click();
    assert.equal(el('resultPane').hidden, true);
    assert.equal(doc.activeElement, doc.querySelector('#choices button'));

    el('openExplainer').click(); assert.equal(el('explainer').open, true);
    key(answer, 'y'); assert.equal(el('resultPane').hidden, true, 'Dialog blocks game shortcut');
    el('closeExplainer').click(); assert.equal(el('explainer').open, false);
    const summary = doc.querySelector('.game details summary');
    const summarySpace = new w.KeyboardEvent('keydown', {key:' ',code:'Space',bubbles:true,cancelable:true});
    summary.dispatchEvent(summarySpace);
    assert.equal(summarySpace.defaultPrevented, false, 'Space remains available to native details behavior');
    const theme = doc.documentElement.getAttribute('data-theme');
    el('themeBtn').click(); assert.notEqual(doc.documentElement.getAttribute('data-theme'), theme);
    el('fixRolling').checked = true; el('fixRolling').dispatchEvent(new w.Event('change'));
    assert.equal(doc.querySelector('[data-key="rolling"]').hidden, false);
    el('fixLimits').checked = true; el('fixLimits').dispatchEvent(new w.Event('change'));
    assert.match(el('legendBand').textContent, /each view|own/i);
    frame(w.performance.now() + 100);

    el('runBtn').click(); assert.equal(el('runBtn').getAttribute('aria-pressed'), 'true');
    frame(w.performance.now() + 1000);
    el('runBtn').click(); assert.equal(el('runBtn').getAttribute('aria-pressed'), 'false');
    assert.equal(el('yearsOut').textContent, '1');
    el('addBtn').click();
    await until(() => el('yearsOut').textContent === '1,001', 'Adding settles pending animated year exactly once');
    for (const [view, readings] of [['annual','1,001'],['quarterly','4,004'],['monthly','12,012'],['rolling','12,012']]) {
      assert.ok(doc.querySelector(`[data-key="${view}"] canvas`).getAttribute('aria-label').includes(`of ${readings} readings`), `${view} preserves reading counts`);
    }
    el('clearBtn').click(); assert.equal(el('yearsOut').textContent, '0');

    el('addBtn').click(); el('clearBtn').click();
    await wait(100);
    assert.equal(el('yearsOut').textContent, '0', 'Clear prevents queued add work repopulating counts');
    assert.equal(el('addBtn').disabled, false);
    el('addBtn').click();
    await until(() => el('yearsOut').textContent === '1,000', 'Add 1,000 completes');
    assert.equal(el('addBtn').disabled, false);
    el('clearBtn').click();

    input('headcount', '12'); input('rate', '40');
    el('addBtn').click();
    await until(() => el('yearsOut').textContent !== '0', 'Add job begins');
    input('headcount', '0'); input('rate', '2');
    await wait(100);
    assert.equal(el('yearsOut').textContent, '0', 'Parameter change cancels old add work');
    assert.equal(el('headcountOut').textContent, '50');
    assert.equal(el('rateOut').textContent, '2%');
    assert.equal(el('scoreboard').hidden, true, 'Parameter changes clear played scoreboard');
    assert.equal(el('rareNote').hidden, false);
    await until(() => el('chanceRed').textContent !== '…', 'Latest benchmark finishes');
    const expectedBenchmark = require('./model-loader.cjs').longRun(50,.02,2000,20260928);
    await wait(300);
    assert.ok(el('chanceRed').textContent.includes(`${expectedBenchmark.pointNumerator}/${expectedBenchmark.pointDenominator}`), 'Only current-parameter benchmark is published');
    assert.ok(el('benchmarkExclusions').textContent.includes(`${expectedBenchmark.degenerate}/2000`));
    // Force an all-zero observed baseline, then verify unavailable presentation.
    // The seeded benchmark has its own RNG and must not be affected.
    w.Math.random = () => .999999;
    input('rate', '3');
    assert.equal(el('unavailableNote').hidden, false);
    doc.querySelector('#choices button').click();
    assert.match(el('verdict').textContent, /unavailable|not evaluable/i);
    assert.doesNotMatch(el('verdict').textContent, /no signal, which is correct/i);
    const xmrRows = [...el('scoreTable').querySelectorAll('tbody tr')].slice(1,3);
    assert.equal(xmrRows.length, 2);
    for (const row of xmrRows) assert.match(row.textContent, /none eligible yet|unavailable/i);
    const returning = new JSDOM(html, {
      url: 'https://turnover.test/', runScripts: 'dangerously', virtualConsole, pretendToBeVisual: true,
      beforeParse(w2) { setupWindow(w2); w2.localStorage.setItem(explainerSeenKey, '1'); }
    });
    try {
      assert.equal(returning.window.document.getElementById('explainer').open, false, 'Returning visit stays on app');
      returning.window.document.getElementById('openExplainer').click();
      assert.equal(returning.window.document.getElementById('explainer').open, true, 'Returning visitor can reopen explainer');
    } finally { returning.window.close(); }
    assert.equal(errors.length, 0, errors.map(String).join('\n'));
    console.log('PASS: first/returning visit explainer, DOM initialization, observed data table, answer/next, scoped keys, theme, dialog wiring, toggles, run/pause, add/clear, parameter cancellation and benchmark completion.');
    console.log('Not covered: rendered layout, native canvas/dialog behavior, screen readers.');
  } finally { w.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
