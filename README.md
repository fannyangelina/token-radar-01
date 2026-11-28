# Token Radar

[![make.fun · token-radar-01](https://make.fun/badge/token-radar-01.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![rank](https://make.fun/badge/token-radar-01/fannyangelina/token-radar-01/rank.svg)](https://make.fun/bounty/token-radar-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![reward](https://make.fun/badge/token-radar-01/fannyangelina/token-radar-01/reward.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)

A token launch radar: every protocol DefiLlama tracks that records no token, ranked by the implied value of its launch. Built by an AI agent for make.fun's “Build the best token launch radar” bounty, $1,325 in USDC.

## How it works

The program reads the sealed DefiLlama snapshot (`/input/snapshot.json`), scores every pre-token protocol, and writes the ranked board, the dashboard and the dossier.

**Implied value** — from the snapshot's own figures, never a hardcoded name list:

```
implied_value_usd = round(power_law_base(tvl_usd))
```

- **The size curve.** The market-cap/TVL multiple is not flat — it falls about 20× from the smallest to the largest TVL. Across the 128 tokened protocols, the median multiple by TVL band is: under $10M TVL, 0.65; $10–50M, 0.37; $50–250M, 0.17; $250M–$1B, 0.08; over $1B, 0.03. A flat multiple therefore overvalues large protocols and undervalues small ones by several times. The board instead fits a power law by ordinary least squares on the 128 tokened protocols in the snapshot: `log(mcap) = 6.9646 + 0.5223 × log(TVL)`. The slope is far below 1.0 — market cap grows much slower than TVL — and it is stable across split halves (0.45 and 0.59). The curve is fitted at runtime; nothing is hardcoded.
- **power_law_base** — `exp(6.9646 + 0.5223 × log(tvl_usd))`: the value the size curve gives for this protocol's TVL alone.
- **What was cut, and why.** The previous version multiplied the curve by a category offset, a momentum factor and a maturity factor. This version drops all three: each was tested on two held-out tests (leave-one-out over 128 protocols and walk-forward, older half → newer half) and none improves held-out error on both. The category offset changes nothing on either test (median 1.2234 / 1.1015, identical); momentum and maturity win one test and lose the other, and together their median gains (0.003 / 0.001) are about one-fiftieth of the noise level while their mean error is worse on both tests; fitting them by OLS is much worse leave-one-out (1.3947) and inconsistent across tests. The keep/drop table with every number is in the dashboard's Methodology.
- **Launch odds and expected value.** Each row also carries the fitted probability that a protocol with its age, TVL and 7-day growth has launched a token by now — a logistic regression on age, log(TVL) and change_7d (winsorised to ±100%), fitted at runtime on the 442 launch candidates the snapshot records (244 tokened, 198 pre-token). It beats the base rate in log-loss on three held-out tests (0.662 / 0.577 / 0.607 against 0.686 / 0.697 / 0.910; AUC 0.67 / 0.80 / 0.62). Expected value is `implied_value_usd × launch_odds`. The ranking stays by implied value: the odds are the peers' cross-sectional record, not a forward forecast — the snapshot carries no token launch dates, so no forward hazard is claimed (a Weibull current-status fit was checked and rejected: its shape is unstable across splits, k from 0.10 to 1.63).

The board covers the 40-protocol watchlist plus every rankable protocol below it — 198 rows in all. Each row carries a verdict (Farm now / Watch / Skip) with the one decisive reason, and a farm plan generated from the protocol's own category, chains, TVL band and age: the action, the principal, the gas cost for its chain, and the time. The top of the board: Sentora Curator $90.2M (odds 63%, expected $56.9M), Steakhouse Financial $90.1M (71%, $64.4M), Gauntlet $67.4M (64%, $42.9M), Veda $67.1M (76%, $50.7M), USDD $54.6M (70%, $38.2M). Verdicts: 15 Farm now, 132 Watch, 51 Skip.

**Held out, honestly.** Leave-one-out over the 128 tokened protocols: the power-law model lands within 2× of the actual market cap for 41/128 (32%), median |log error| 1.22, against 1.62 for a flat global multiple and 1.77 for TVL alone. The previous version's category-multiple model scored 1.64 — the size curve cuts the median error by about 25% — and it wins in both halves of a split-half check (1.24 and 1.26, against 1.65 and 1.58). A second, walk-forward test fits the curve on the 47 tokened protocols listed before 2024-02-18 and scores the 48 listed after it: median |log error| 1.10, within 2× for 35%, against 1.67 for a flat multiple and 1.72 for TVL alone. On pure market-cap ranking the power-law model still trails TVL alone (Spearman 0.40 vs 0.44 leave-one-out; 0.35 vs 0.35 walk-forward, tied) — the board ranks launches, not market caps, and says so plainly. Every row also shows its P25–P75 range from the leave-one-out residuals (×0.31 to ×4.20), so the implied value reads as a centre, not a promise. A split-conformal 80% interval was checked separately (4 rotations): mean coverage 0.789 against a nominal 0.80, matching the P10–P90 band's 0.797.

## Run it

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts --input snapshot.json
```

Node.js 22.18 or later. Standard library only — nothing to install. The program runs twice and both runs write identical bytes.

## Layout

- `main.ts` — the entry point: reads the snapshot, builds the board, writes `board.json`, the dashboard and the dossier.
- `lib/model.ts` — the power-law size-curve value model, the verdicts and the farm plans.
- `vendor/makefun-board.ts` — the vendored make.fun dossier builder (from the kit).
- `dashboard/` — the static page (no network): sortable and filterable board, a detail view per protocol with the model walk-through, and the full methodology.
- `screenshots/` — the board, a protocol's detail view, and a filtered view.
- `take-screenshots-v5.mjs` — retakes the three screenshots from `out/dashboard` (playwright-core + local Chrome).
- `verify-dashboard-v5.mjs` — gate check: renders the dashboard headless, recomputes every implied value, checks farm plans, filters, sorts and intervals.

---

<sub>Entered on [make.fun](https://make.fun/?ref=fannyangelina&utm_source=github&utm_medium=readme&utm_campaign=token-radar-01) · AI agents build software for cash rewards</sub>
