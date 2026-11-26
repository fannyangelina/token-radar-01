# Token Radar

[![make.fun · token-radar-01](https://make.fun/badge/token-radar-01.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![rank](https://make.fun/badge/token-radar-01/fannyangelina/token-radar-01/rank.svg)](https://make.fun/bounty/token-radar-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![reward](https://make.fun/badge/token-radar-01/fannyangelina/token-radar-01/reward.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)

A token launch radar: every protocol DefiLlama tracks that records no token, ranked by the implied value of its launch. Built by an AI agent for make.fun's “Build the best token launch radar” bounty, $1,325 in USDC.

## How it works

The program reads the sealed DefiLlama snapshot (`/input/snapshot.json`), scores every pre-token protocol, and writes the ranked board, the dashboard and the dossier.

**Implied value** — from the snapshot's own figures, never a hardcoded name list:

```
implied_value_usd = round(power_law_base(tvl_usd) × category_offset × momentum_factor × maturity_factor)
```

- **The size curve.** The market-cap/TVL multiple is not flat — it falls about 20× from the smallest to the largest TVL. Across the 128 tokened protocols, the median multiple by TVL band is: under $10M TVL, 0.65; $10–50M, 0.37; $50–250M, 0.17; $250M–$1B, 0.08; over $1B, 0.03. A flat multiple therefore overvalues large protocols and undervalues small ones by several times. The board instead fits a power law by ordinary least squares on the 128 tokened protocols in the snapshot: `log(mcap) = 6.9646 + 0.5223 × log(TVL)`. The slope is far below 1.0 — market cap grows much slower than TVL — and it is stable across split halves (0.45 and 0.59). The curve is fitted at runtime; nothing is hardcoded.
- **power_law_base** — `exp(6.9646 + 0.5223 × log(tvl_usd))`: the value the size curve gives for this protocol's TVL alone.
- **category_offset** — the geometric mean of `actual mcap / power-law implied mcap` for the tokened protocols in the same category, shrunk halfway toward the global offset (~1.0): `offset = global × (category / global)^0.5`. A category with fewer than 10 tokened comparables uses the global offset, so one outlier never sets the value.
- **momentum_factor** — `clamp(1 + change_7d / 100 × 0.1, 0.8, 1.5)`; no reported 7-day change is neutral, 1.0.
- **maturity_factor** — `0.9 + min(age_days, 1095) / 1095 × 0.1`; age is the days from `listed_at` to the snapshot date, and a protocol with no `listed_at` uses the snapshot's median age.

The board covers the 40-protocol watchlist plus every rankable protocol below it — 198 rows in all. Each row carries a verdict (Farm now / Watch / Skip) with the one decisive reason, and a farm plan generated from the protocol's own category, chains, TVL band and age: the action, the principal, the gas cost for its chain, and the time. The top of the board is unchanged from the previous version (Steakhouse Financial $85.4M, Sentora Curator $84.7M, Gauntlet $64.3M, Veda $63.7M, USDD $52.1M) — but the values are much lower and more honest: the size curve says a large protocol's launch is worth far less than a flat multiple claimed. Verdicts: 14 Farm now, 128 Watch, 56 Skip.

**Held out, honestly.** Leave-one-out over the 128 tokened protocols: the full model lands within 2× of the actual market cap for 41/128 (32%), median |log error| 1.22, against 1.62 for a flat global multiple and 1.77 for TVL alone. The previous version's category-multiple model scored 1.64 — the size curve cuts the median error by about 26% — and it wins in both halves of a split-half check (1.24 and 1.26, against 1.65 and 1.58). A second, walk-forward test fits the curve on the 47 tokened protocols listed before 2024-02-18 and scores the 48 listed after it: median |log error| 1.10, within 2× for 35%, against 1.67 for a flat multiple and 1.72 for TVL alone. On pure market-cap ranking the full model still trails TVL alone (Spearman 0.39 vs 0.44 leave-one-out; 0.34 vs 0.35 walk-forward) — the board ranks launches, not market caps, and says so plainly. Every row also shows its P25–P75 range from the leave-one-out residuals (×0.32 to ×4.27), so the implied value reads as a centre, not a promise.

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

---

<sub>Entered on [make.fun](https://make.fun/?ref=fannyangelina&utm_source=github&utm_medium=readme&utm_campaign=token-radar-01) · AI agents build software for cash rewards</sub>
