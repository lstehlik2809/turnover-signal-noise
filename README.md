# Nothing changed. The dashboard disagrees.

**[Open the interactive turnover simulation](https://lstehlik2809.github.io/turnover-signal-noise/)**

How much of a turnover dashboard's movement is signal, and how much is sampling noise? This small app grew out of a question about reporting monthly annualized turnover beside an annual rate. It simulates a company whose underlying turnover does not change, then shows what annual, quarterly, and monthly reporting would make us think happened.

At the default settings, the company has 1,000 people and an expected turnover rate of 10% a year. That means roughly 100 leavers per year, 25 per quarter, or eight per month. Annualizing those smaller counts makes the rates comparable in units, but it does not give them the precision of a full year of data. Against an annual mean ±2 standard deviation band, about **37% of quarters** and **60% of months** land outside the band even though the underlying rate is constant.

## Explore and play

- Adjust headcount and the underlying annual turnover rate to see how sample size changes the apparent variation.
- Compare annual, quarterly, monthly, and rolling 12-month views. Try limits sized to each reporting window.
- Play a 24-month dashboard game. In half of the rounds, a real change is hidden in the data. Decide whether the rate changed, then compare your call with three XmR chart rules and an informed statistical reference. Each answer also reveals a rolling 12-month line beside the true rate; use the checkbox to hide or show it.

On your first visit in a browser, the “What am I looking at?” explainer opens automatically. Close it to explore the app; its button in the header opens it again whenever you need it.

The game makes the tradeoff concrete. With a 12-month baseline, a rule that waits for one point beyond the XmR limits misses about **58%** of simulated 25–60% relative changes before the dashboard ends. Using all three rules reduces misses to about **20%**, while at least one rule fires in about **40%** of dashboards with no change. These are results for the stated simulation, not general performance guarantees. See [the benchmark and its definitions](BENCHMARK.md) for denominators, timing, intervals, and reproducibility.

The rolling comparison sums the last 12 months’ actual leavers and divides by headcount. Test month 1 uses baseline months 2–12 plus test month 1, with no future data. A sustained change begins affecting the expected rolling rate immediately and is fully reflected after 12 changed months; observed values still fluctuate. The line is shown by default after each answer, and its values are available in the observed-data table. XmR limits and scoring still apply only to monthly readings.

The practical question is which yardstick fits the window and the decision. A rolling 12-month rate is steadier under a constant rate, but spreads a real change across overlapping windows. Window-specific ranges make short-window readings easier to interpret, but more ways to flag a chart also create more false alarms. Showing the **count of leavers** beside a rate helps keep the size of the sample visible.

## Run locally

Open `index.html` in a browser. The app is a single static HTML file, with no build step or application dependencies. Google Fonts are optional; the page has system font fallbacks.

To run the model tests:

```powershell
node tests/model.test.cjs
node tests/rolling.test.cjs
node tests/dom.test.cjs
python tests/independent-checks.py
```

The Python check requires NumPy and SciPy. Further test instructions and the reproducible publication run are in [BENCHMARK.md](BENCHMARK.md).

## Model and interpretation

Each month draws an independent binomial count with a fixed headcount. People who leave are replaced. The model deliberately leaves out seasonality, clustered exits, changing headcount, and differences among teams. The game introduces a hidden change in half of its rounds. Its informed reference knows the true starting rate and how changes are generated, so it is a benchmark for this game rather than a fair head-to-head competitor for a person or an XmR chart in real work.

This project was inspired in part by a Monte Carlo illustration credited to Lipinski (2017). The XmR rules used in the game follow [Stehlík (2024)](https://blog-about-people-analytics.netlify.app/posts/2024-10-30-xmr-charts-in-people-analytics/).
