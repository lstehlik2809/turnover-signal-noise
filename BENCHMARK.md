# Turnover simulation: method and verification

The app remains a standalone `index.html`; no build or application dependencies are required. Its first script contains the pure model, used both by the interface and the validation scripts.

## Publication figures

`benchmark-results.json` records a reproducible 100,000-round run with headcount 1,000, expected annual exits/headcount 10%, and seed **20260928**. It includes the model source SHA-256, exact counts, denominators and Wilson 95% Monte Carlo intervals. The post rounds these results.

Each round has 12 independent baseline months and 24 test months. Each monthly count is binomial with parameters `N` and `annual rate / 12`. Half the rounds change in expectation; change month is uniform over months 7–18, direction has equal probabilities, and relative magnitude is uniform over 25–60%. Leavers are replaced; annual turnover is an expected exit count divided by headcount, not an original employee's annual exit probability.

| Measure | Result | 95% Monte Carlo interval |
| --- | ---: | ---: |
| Rule 1: no signal at/after change by month 24 | 29,244 / 50,019 = 58.47% | 58.03–58.90% |
| Rules 1–3: no signal at/after change by month 24 | 10,068 / 50,019 = 20.13% | 19.78–20.48% |
| Rules 1–3: any signal in a stable round | 20,169 / 49,981 = 40.35% | 39.92–40.78% |
| Approximate oracle: whole-round classification accuracy | 93,594 / 100,000 = 93.59% | See the separate error-rate intervals in the JSON |

There were no zero-moving-range baselines in this publication run. At other settings they can be common. The app labels these rounds unavailable for XmR, excludes them from XmR denominators and retains them for human/oracle classification. Thus sparse-setting XmR results are conditional on an evaluable baseline.

Classification and detection are distinct: an alarm before a later change supports a positive whole-round classification but does not count as post-change detection. Detection here means that a rule completes at or after the change, including the change month, through month 24. It does not prove that the change caused the signal. Mean delay is conditional on detected, evaluable changed rounds; no-signal rounds are not assigned zero delay. The available follow-up varies with the change month.

The approximate oracle knows the true baseline and change distribution. It averages likelihood ratios over change months, directions and a 64-point midpoint approximation to the continuous magnitude prior. This is an informed reference, not an exact universal performance bound or a matched-information comparison with XmR.

The default annual mean ±2 SD band is **8.008350767–11.991649233%**, with strict outside-band comparisons. Exact binomial probabilities outside that band are **4.99197% annually, 36.55973% quarterly and 59.84253% monthly**. Replacing the band with an inclusive 8–12% interval changes the quarterly result to **26.82741%**. The default monthly own-window ±2 SD band flags **3.35028%**, not exactly 5%. These reference bands are distinct from conventional three-sigma p-chart limits.

SDs are **0.995825, 1.991649 and 3.449638 percentage points** respectively. An 83-person team's annual SD is about 3.45660 pp under the same model. Rolling 12-month readings have the annual marginal distribution but adjacent values correlate at 11/12. Expected flagged-reading counts per year are not independent-alarm probabilities.

## Reproduce and verify

From this directory:

```powershell
node tests/model.test.cjs
python tests/independent-checks.py
node tests/dom.test.cjs
node tests/publication-benchmark.cjs 100000
```

The Python check requires NumPy and SciPy. It independently checks binomial probabilities and SDs at eight settings, the oracle against a 4,096-point likelihood integration, and Wilson interval boundaries. The model tests cover exact XmR boundaries/ties, unavailable baselines, scoring/timing, seeded reproducibility and cancellation interleavings.

The DOM test uses jsdom installed outside the project. If needed:

```powershell
npm install --prefix "$env:TEMP\turnover-audit-tools" jsdom --no-audit --no-fund
```

It tests initialization, observed-data access, keyboard scope, answer/next flow, control wiring and cancellation. Canvas and dialog APIs are stubbed; this is **not rendered or screen-reader verification**. Browser security policy rejected the local HTML URL, including a retry after the user explicitly authorized access. Desktop/mobile layout, native dialog behavior and actual rendering therefore remain unverified.

The public app is available at https://lstehlik2809.github.io/turnover-signal-noise/.
