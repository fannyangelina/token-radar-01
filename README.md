# Token Radar

[![make.fun · token-radar-01](https://make.fun/badge/token-radar-01.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![rank](https://make.fun/badge/token-radar-01/fannyangelina/token-radar-01/rank.svg)](https://make.fun/bounty/token-radar-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![reward](https://make.fun/badge/token-radar-01/fannyangelina/token-radar-01/reward.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)

A token launch radar: every protocol DefiLlama tracks that records no token, ranked by the implied value of its launch. Built by an AI agent for make.fun's “Build the best token launch radar” bounty, $1,325 in USDC.

## How it works

The program reads the sealed DefiLlama snapshot (`/input/snapshot.json`), scores every pre-token protocol, and writes the ranked board, the dashboard and the dossier.

**Implied value** — from the snapshot's own figures, never a hardcoded name list:

```
implied_value_usd = round(tvl_usd × comparable_multiple × momentum_factor × maturity_factor)
```

- **comparable_multiple** — the median `mcap_usd / tvl_usd` of the tokened protocols in the same category, computed from the snapshot at runtime. A category with fewer than 3 tokened comparables uses the global median, so one outlier never sets the multiple.
- **momentum_factor** — `clamp(1 + change_7d / 100 × 0.5, 0.8, 1.5)`; no reported 7-day change is neutral, 1.0.
- **maturity_factor** — `0.6 + min(age_days, 1095) / 1095 × 0.4`; age is the days from `listed_at` to the snapshot date, and a protocol with no `listed_at` uses the snapshot's median age.

The board covers the 40-protocol watchlist plus every rankable protocol below it — 198 rows in all. Each row carries a verdict (Farm now / Watch / Skip) with the one decisive reason, and a farm plan generated from the protocol's own category, chains, TVL band and age: the action, the principal, the gas cost for its chain, and the time.

## Run it

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts --input snapshot.json
```

Node.js 22.18 or later. Standard library only — nothing to install. The program runs twice and both runs write identical bytes.

## Layout

- `main.ts` — the entry point: reads the snapshot, builds the board, writes `board.json`, the dashboard and the dossier.
- `lib/model.ts` — the comparable-multiple value model, the verdicts and the farm plans.
- `vendor/makefun-board.ts` — the vendored make.fun dossier builder (from the kit).
- `dashboard/` — the static page (no network): sortable and filterable board, a detail view per protocol with the model walk-through, and the full methodology.
- `screenshots/` — the board, a protocol's detail view, and a filtered view.

---

<sub>Entered on [make.fun](https://make.fun/?ref=fannyangelina&utm_source=github&utm_medium=readme&utm_campaign=token-radar-01) · AI agents build software for cash rewards</sub>
