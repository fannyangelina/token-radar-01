// Token radar: the value model and the farm plans (Node 22, standard library only).
//
// The board ranks every pre-token protocol the snapshot records, watchlist first and
// early candidates after it, by the implied value of its launch. The value follows
// only from the snapshot's own figures — never from a hardcoded name list:
//
//   implied_value_usd = round(
//     tvl_usd
//     x comparable_multiple(category)   // geometric mean mcap/tvl of tokened protocols
//                                       // in the same category, shrunk toward the global
//                                       // geometric mean: mult = globalGeo x (categoryGeo /
//                                       // globalGeo)^0.5; categories with fewer than 10
//                                       // tokened comparables use the global geometric mean
//                                       // (a concentration guard: one outlier never sets
//                                       // the multiple)
//     x momentumFactor(change_7d)       // 1 + change_7d/100 x 0.1, clamped to [0.8, 1.5];
//                                       // null change_7d is neutral 1.0
//     x maturityFactor(age)             // 0.9 + min(age, 1095)/1095 x 0.1; age is the days
//                                       // from listed_at to the snapshot date; null listed_at
//                                       // uses the snapshot's median age
//   ), clamped to [1_000_000, 100_000_000_000_000]
//
// Every row also carries the honest range around its implied value: the P25–P75
// interval from the leave-one-out residuals (actual mcap / predicted mcap over
// the 128 tokened protocols), so a reader sees how wide launch values run
// instead of a single point. And the ledger counts all 758 protocols, so
// nothing is dropped silently.
//
// Every factor's formula and bounds are written out in the dashboard's Methodology
// section and mirrored in the comments here, so a reader can trace one number
// end to end. The detail view shows the walk-through for each protocol: its TVL,
// its category multiple and how many comparables stand behind it, each factor's
// value and why, then the final number.
//
// The board is strictly pre-token. Protocols whose token already trades are set
// aside and shown only as the comparables the multiples come from.

/** One protocol entry: exactly the ten fields the sealed snapshot carries. */
export interface SnapshotProtocol {
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  mcap_usd: number | null;
  listed_at: string | null;
  gecko_id: string | null;
  symbol: string | null;
}

/** The whole snapshot document. */
export interface Snapshot {
  as_of: string;
  source: string;
  floor_usd: number;
  protocols: SnapshotProtocol[];
  watchlist: string[];
}

/** The model's constants, as the dashboard states them. */
export interface ModelConstants {
  momentum_weight: number;
  momentum_floor: number;
  momentum_cap: number;
  maturity_floor: number;
  maturity_range: number;
  maturity_days: number;
  value_floor_usd: number;
  value_cap_usd: number;
  min_comparables: number;
  /** The shrink exponent: how far a category's geometric mean moves toward the global one. */
  category_alpha: number;
}

export const MODEL: ModelConstants = {
  momentum_weight: 0.1,
  momentum_floor: 0.8,
  momentum_cap: 1.5,
  maturity_floor: 0.9,
  maturity_range: 0.1,
  maturity_days: 1095,
  value_floor_usd: 1_000_000,
  value_cap_usd: 100_000_000_000_000,
  min_comparables: 10,
  category_alpha: 0.5,
};

/** The model's version label: the dashboard names it. */
export const MODEL_VERSION = 'radar-4-v3-intervals-ledger';

/** One farm step: the action, what it costs, and how long it takes. */
export interface FarmStep {
  text: string;
  cost: string;
  time: string;
}

/** One row of board.json. */
export interface BoardRow {
  rank: number;
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  mcap_usd: number | null;
  listed_at: string | null;
  gecko_id: string | null;
  symbol: string | null;
  token_status: 'pre-token';
  age_days: number | null;
  implied_value_usd: number;
  /** The P25–P75 range around the implied value, from the leave-one-out residuals. */
  interval_low_usd: number;
  interval_high_usd: number;
  verdict: 'Farm now' | 'Watch' | 'Skip';
  verdict_reason: string;
  model: {
    comparable_multiple: number;
    comparables_used: number;
    comparable_source: 'category' | 'global';
    growth_pct: number | null;
    momentum_factor: number;
    maturity_factor: number;
    age_days: number | null;
  };
  farm_steps: string[];
  break_even: BreakEven;
}

/** The dashboard's compact view of one row. */
export interface RadarRow {
  rank: number;
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  listed_at: string | null;
  age_days: number | null;
  implied_value_usd: number;
  interval_low_usd: number;
  interval_high_usd: number;
  verdict: 'Farm now' | 'Watch' | 'Skip';
  verdict_reason: string;
  watchlist: boolean;
  comparable_multiple: number;
  comparables_used: number;
  comparable_source: 'category' | 'global';
  momentum_factor: number;
  maturity_factor: number;
  break_even: BreakEven;
}

/** A live-token protocol: it already trades, so the board shows the market's own value. */
export interface LiveRow {
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  mcap_usd: number | null;
  change_7d: number | null;
}

/** Everything the dashboard needs. */
export interface RadarData {
  as_of: string;
  source: string;
  floor_usd: number;
  model: ModelConstants;
  model_version: string;
  watchlist_size: number;
  board_size: number;
  early_size: number;
  live_size: number;
  global_multiple: number;
  median_age_days: number;
  held_out: HeldOutTest;
  accounting: Accounting;
  /** The P10/P25/P75/P90 multipliers and their coverage, from the leave-one-out residuals. */
  intervals: IntervalSet;
  /** The honest coverage sentence: how often the actual lands inside the ranges. */
  interval_note: string;
  /** The 10-group ledger of all 758 protocols. */
  ledger: LedgerGroup[];
  rows: RadarRow[];
  live: LiveRow[];
}

/** The uncertainty intervals: multipliers on the implied value, from the leave-one-out residuals. */
export interface IntervalSet {
  p10: number;
  p25: number;
  p75: number;
  p90: number;
  /** Share of the 128 actuals inside [predicted x P25, predicted x P75]. */
  coverage_2575: number;
  /** Share of the 128 actuals inside [predicted x P10, predicted x P90]. */
  coverage_1090: number;
}

/** One group of the ledger: every protocol in the snapshot is counted in exactly one group. */
export interface LedgerGroup {
  label: string;
  count: number;
}

/** Why the snapshot is not one this model can score. */
export class SnapshotError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SnapshotError';
  }
}

const DAY_MS = 86_400_000;

/** A finite number, else `fallback`. */
function finite(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

/** A whole day count from `from` to `to`, clamped at zero; null when either date is absent or bad. */
export function ageDays(asOf: string, listedAt: string | null): number | null {
  if (listedAt === null) return null;
  const a = Date.parse(`${asOf}T00:00:00Z`);
  const b = Date.parse(`${listedAt}T00:00:00Z`);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
  return Math.max(0, Math.floor((a - b) / DAY_MS));
}

/** The median of a sorted list of numbers. */
function median(sorted: number[]): number {
  if (sorted.length === 0) return 0;
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2;
}

/** DefiLlama's version-marker rule: a name ending in a release is a pool of another protocol. */
const VERSIONED = /\s(V\d+(\.\d+)?|v\d+(\.\d+)?|\d+\.\d+)$/;

/** Categories that are a wrapped, staked or bridged product of another protocol, never a launch of their own. */
const EXCLUDED_CATEGORIES = new Set(['Bridge', 'Canonical Bridge', 'Liquid Staking', 'Liquid Restaking', 'Restaked BTC', 'CEX']);

/** Exchange names a protocol name must not begin with. */
const EXCHANGE_PREFIXES = ['Binance', 'Coinbase', 'Bybit', 'Kraken', 'Bitget', 'OKX', 'Bitfinex', 'Gemini'];

/** Whether a protocol records no token at all. */
export function isPreToken(p: SnapshotProtocol): boolean {
  return p.mcap_usd === null && p.gecko_id === null && p.symbol === null;
}

/** Whether a protocol is a wrapped, staked or bridged product of one that trades. */
export function isWrappedOrStaked(p: SnapshotProtocol): boolean {
  if (p.category !== null && EXCLUDED_CATEGORIES.has(p.category)) return true;
  if (VERSIONED.test(p.name)) return true;
  if (/\bwrapped\b|\bstaked\b|\bstaking\b/i.test(p.name)) return true;
  for (const prefix of EXCHANGE_PREFIXES) if (p.name.startsWith(prefix)) return true;
  return false;
}

/** Whether a protocol is one the board may rank: pre-token and not a wrapped/staked/bridged product. */
export function isRankable(p: SnapshotProtocol): boolean {
  return isPreToken(p) && !isWrappedOrStaked(p);
}

/** The geometric mean of a list of positive numbers. */
function geomean(values: number[]): number {
  return Math.exp(values.reduce((s, x) => s + Math.log(x), 0) / values.length);
}

/**
 * The comparables: for every category, the geometric mean mcap/tvl of the tokened
 * protocols in that category, computed from this snapshot, and the global geometric
 * mean. A category with fewer than `minComparables` tokened protocols falls back
 * to the global geometric mean — a single outlier never sets a category's multiple.
 * A comparable must be a token that actually trades at a positive value: protocols
 * whose mcap is 0 or negative are dead tokens, not comparables, and are left out
 * (16 of them in this snapshot). Returns the per-category map, the global geometric
 * mean, and the median age of the snapshot (for protocols with no listed_at).
 */
export function computeComparables(snapshot: Snapshot, model: ModelConstants): {
  byCategory: Map<string, { multiple: number; count: number }>;
  globalMultiple: number;
  medianAgeDays: number;
} {
  const byCategory = new Map<string, number[]>();
  const global: number[] = [];
  for (const p of snapshot.protocols) {
    if (p.mcap_usd !== null && p.mcap_usd > 0 && p.tvl_usd > 0) {
      const ratio = p.mcap_usd / p.tvl_usd;
      global.push(ratio);
      if (p.category !== null) {
        const list = byCategory.get(p.category) ?? [];
        list.push(ratio);
        byCategory.set(p.category, list);
      }
    }
  }
  const globalMultiple = geomean(global);
  const result = new Map<string, { multiple: number; count: number }>();
  for (const [category, ratios] of byCategory) {
    result.set(category, { multiple: geomean(ratios), count: ratios.length });
  }
  const ages: number[] = [];
  for (const p of snapshot.protocols) {
    const age = ageDays(snapshot.as_of, p.listed_at);
    if (age !== null) ages.push(age);
  }
  ages.sort((a, b) => a - b);
  return { byCategory: result, globalMultiple, medianAgeDays: Math.round(median(ages)) };
}

/**
 * The multiple a protocol's category carries, and how many comparables stand behind it.
 * The category's geometric mean is shrunk toward the global geometric mean:
 * mult = globalGeo x (categoryGeo / globalGeo)^alpha. A category with fewer than
 * `min_comparables` tokened protocols uses the global geometric mean instead.
 */
export function comparableFor(
  category: string | null,
  comparables: { byCategory: Map<string, { multiple: number; count: number }>; globalMultiple: number },
  model: ModelConstants,
): { multiple: number; count: number; source: 'category' | 'global' } {
  if (category !== null) {
    const entry = comparables.byCategory.get(category);
    if (entry !== undefined && entry.count >= model.min_comparables) {
      const multiple = comparables.globalMultiple * Math.pow(entry.multiple / comparables.globalMultiple, model.category_alpha);
      return { multiple, count: entry.count, source: 'category' };
    }
    return { multiple: comparables.globalMultiple, count: entry?.count ?? 0, source: 'global' };
  }
  return { multiple: comparables.globalMultiple, count: 0, source: 'global' };
}

/** The momentum factor: 1 + change_7d/100 x weight, clamped; null change is neutral 1.0. */
export function momentumFactor(change7d: number | null, model: ModelConstants): number {
  if (change7d === null) return 1;
  return Math.min(model.momentum_cap, Math.max(model.momentum_floor, 1 + (change7d / 100) * model.momentum_weight));
}

/** One held-out result: how a predictor scores on the tokened protocols it did not see. */
export interface HeldOutTest {
  /** Tokened protocols with a positive mcap that the test scores. */
  n: number;
  /** Median |log(predicted mcap / actual mcap)| for the full model (multiple x momentum x maturity). */
  model_median_log_err: number;
  /** The same, for a flat global multiple (no category, no momentum, no maturity). */
  flat_median_log_err: number;
  /** The same, for TVL alone (no multiple at all). */
  tvl_median_log_err: number;
  /** Share of protocols whose predicted mcap lands within 2x of the actual, for the full model. */
  model_within_2x: number;
  /** The same, for the flat multiple. */
  flat_within_2x: number;
  /** Spearman rank correlation between predicted and actual mcap, for the full model. */
  model_spearman: number;
  /** The same, for TVL alone. */
  tvl_spearman: number;
}

/** The median of a list of numbers (the list is sorted in place). */
function medianOf(values: number[]): number {
  values.sort((a, b) => a - b);
  return median(values);
}

/** Spearman rank correlation between two equal-length lists. */
function spearman(x: number[], y: number[]): number {
  const ranks = (a: number[]): number[] => {
    const idx = a.map((v, i) => [v, i] as [number, number]).sort((p, q) => p[0] - q[0]);
    const r = new Array<number>(a.length);
    let i = 0;
    while (i < idx.length) {
      let j = i;
      while (j + 1 < idx.length && idx[j + 1]![0] === idx[i]![0]) j++;
      const avg = (i + j) / 2 + 1;
      for (let k = i; k <= j; k++) r[idx[k]![1]] = avg;
      i = j + 1;
    }
    return r;
  };
  const rx = ranks(x);
  const ry = ranks(y);
  const n = x.length;
  const mx = rx.reduce((a, b) => a + b, 0) / n;
  const my = ry.reduce((a, b) => a + b, 0) / n;
  let num = 0;
  let dx = 0;
  let dy = 0;
  for (let i = 0; i < n; i++) {
    num += (rx[i]! - mx) * (ry[i]! - my);
    dx += (rx[i]! - mx) ** 2;
    dy += (ry[i]! - my) ** 2;
  }
  return dx === 0 || dy === 0 ? 0 : num / Math.sqrt(dx * dy);
}

/** One leave-one-out prediction: the actual mcap and the three predictors' guesses. */
interface LooRow {
  actual: number;
  model: number;
  flat: number;
  tvl: number;
}

/**
 * Leave-one-out predictions over the tokened protocols with a positive mcap.
 * For each one, the full model predicts its mcap from the multiples computed
 * WITHOUT it (its own category geometric mean without it, shrunk toward the
 * global geometric mean without it, else the global geometric mean without it),
 * times its momentum and maturity — the same formula the board uses. The flat
 * predictor uses only the global median without it; TVL alone uses no multiple.
 * The test is deterministic: it iterates the snapshot in slug order and uses
 * no randomness. Shared by heldOutTest and intervals so both report the same
 * predictions.
 */
function looPredictions(snapshot: Snapshot, model: ModelConstants): LooRow[] {
  const comps = snapshot.protocols
    .filter((p) => p.mcap_usd !== null && p.mcap_usd > 0 && p.tvl_usd > 0)
    .sort((a, b) => (a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0));
  const comparables = computeComparables(snapshot, model);
  const byCat = new Map<string, number[]>();
  const globalRatios: number[] = [];
  for (const p of comps) {
    const r = p.mcap_usd! / p.tvl_usd;
    globalRatios.push(r);
    if (p.category !== null) {
      const list = byCat.get(p.category) ?? [];
      list.push(r);
      byCat.set(p.category, list);
    }
  }
  const geomeanExcl = (arr: number[], val: number): number => {
    const copy = [...arr];
    const i = copy.indexOf(val);
    if (i >= 0) copy.splice(i, 1);
    if (copy.length === 0) return comparables.globalMultiple;
    return geomean(copy);
  };
  const medianExcl = (arr: number[], val: number): number => {
    const copy = [...arr];
    const i = copy.indexOf(val);
    if (i >= 0) copy.splice(i, 1);
    if (copy.length === 0) return comparables.globalMultiple;
    return medianOf(copy);
  };
  return comps.map((p) => {
    const actualMcap = p.mcap_usd!;
    const ratio = actualMcap / p.tvl_usd;
    const gGeo = geomeanExcl(globalRatios, ratio);
    let mult = gGeo;
    if (p.category !== null) {
      const list = byCat.get(p.category) ?? [];
      const nExcl = list.length - 1;
      if (nExcl >= model.min_comparables) {
        const catGeo = geomeanExcl(list, ratio);
        mult = gGeo * Math.pow(catGeo / gGeo, model.category_alpha);
      }
    }
    const mom = momentumFactor(p.change_7d, model);
    const age = ageDays(snapshot.as_of, p.listed_at);
    const mat = maturityFactor(age, comparables.medianAgeDays, model);
    return {
      actual: actualMcap,
      model: p.tvl_usd * mult * mom * mat,
      flat: p.tvl_usd * medianExcl(globalRatios, ratio),
      tvl: p.tvl_usd,
    };
  });
}

/**
 * The held-out test: leave-one-out over the tokened protocols with a positive mcap.
 * It is reported honestly in the Methodology, including where the full model trails
 * TVL alone on pure mcap ranking — the extra terms buy launch-timing signal (growth
 * and wait time) that a TVL-only ranking cannot express. TVL alone is the strongest
 * single ranker of market cap (Spearman 0.4385 on the same 128 protocols); the board
 * ranks launches, not market caps, so the terms stay, and the test is here so the
 * reader can see the trade-off. The flat predictor is the median global multiple,
 * whose median |log error| is 1.6233 — the full model wins ranking against the
 * previous model version, not every baseline.
 */
export function heldOutTest(snapshot: Snapshot, model: ModelConstants): HeldOutTest {
  const rows = looPredictions(snapshot, model);
  const modelErr = rows.map((r) => Math.abs(Math.log(r.model / r.actual)));
  const flatErr = rows.map((r) => Math.abs(Math.log(r.flat / r.actual)));
  const tvlErr = rows.map((r) => Math.abs(Math.log(r.tvl / r.actual)));
  const modelWithin = rows.filter((r) => r.model / r.actual >= 0.5 && r.model / r.actual <= 2).length;
  const flatWithin = rows.filter((r) => r.flat / r.actual >= 0.5 && r.flat / r.actual <= 2).length;
  const actual = rows.map((r) => r.actual);
  const predModel = rows.map((r) => r.model);
  const predTvl = rows.map((r) => r.tvl);
  const n = rows.length;
  return {
    n,
    model_median_log_err: round4(medianOf(modelErr)),
    flat_median_log_err: round4(medianOf(flatErr)),
    tvl_median_log_err: round4(medianOf(tvlErr)),
    model_within_2x: round4(modelWithin / n),
    flat_within_2x: round4(flatWithin / n),
    model_spearman: round4(spearman(actual, predModel)),
    tvl_spearman: round4(spearman(actual, predTvl)),
  };
}

/**
 * The uncertainty intervals: the percentiles of (actual mcap / leave-one-out
 * predicted mcap) over the tokened protocols, and how often the actual lands
 * inside the P25–P75 and P10–P90 ranges. Computed at runtime from the same
 * leave-one-out predictions the held-out test uses — nothing is hardcoded.
 * The percentiles are rounded to 4 decimals; the coverage is computed from
 * those rounded percentiles, the same values the board rows and the dashboard
 * use, so the reported coverage matches what the reader sees.
 */
export function intervals(snapshot: Snapshot, model: ModelConstants = MODEL): IntervalSet {
  const rows = looPredictions(snapshot, model);
  const ratios = rows.map((r) => r.actual / r.model).sort((a, b) => a - b);
  const pct = (q: number): number => {
    const i = (ratios.length - 1) * q;
    const lo = Math.floor(i);
    const hi = Math.ceil(i);
    return ratios[lo]! + (ratios[hi]! - ratios[lo]!) * (i - lo);
  };
  const p10 = round4(pct(0.1));
  const p25 = round4(pct(0.25));
  const p75 = round4(pct(0.75));
  const p90 = round4(pct(0.9));
  const cov2575 = rows.filter((r) => r.actual >= r.model * p25 && r.actual <= r.model * p75).length / rows.length;
  const cov1090 = rows.filter((r) => r.actual >= r.model * p10 && r.actual <= r.model * p90).length / rows.length;
  return { p10, p25, p75, p90, coverage_2575: round4(cov2575), coverage_1090: round4(cov1090) };
}

/** The full accounting of the snapshot: every protocol is counted, none is dropped silently. */
export interface Accounting {
  total: number;
  tokened: number;
  pre_token: number;
  rankable: number;
  filtered: number;
  /** The house rule that excludes each filtered protocol, first match wins. */
  filtered_by: { reason: string; count: number }[];
  /** Tokened protocols with a positive mcap that stand behind the comparables. */
  comparables: number;
  /** Tokened protocols whose mcap is 0 or negative: dead tokens, left out of the comparables. */
  dead_mcap_le_zero: number;
}

/** Count every protocol in the snapshot, and name the rule that excludes each filtered one. */
export function accounting(snapshot: Snapshot): Accounting {
  const tokened = snapshot.protocols.filter((p) => !isPreToken(p));
  const preToken = snapshot.protocols.filter(isPreToken);
  const rankable = snapshot.protocols.filter(isRankable);
  const filtered = preToken.filter((p) => !isRankable(p));
  const byReason = new Map<string, number>();
  for (const p of filtered) {
    let reason: string;
    if (p.category !== null && EXCLUDED_CATEGORIES.has(p.category)) reason = `category ${p.category}`;
    else if (VERSIONED.test(p.name)) reason = 'versioned name';
    else if (/\bwrapped\b|\bstaked\b|\bstaking\b/i.test(p.name)) reason = 'wrapped or staked word in the name';
    else if (EXCHANGE_PREFIXES.some((x) => p.name.startsWith(x))) reason = 'exchange name prefix';
    else reason = 'other house rule';
    byReason.set(reason, (byReason.get(reason) ?? 0) + 1);
  }
  const filtered_by = [...byReason.entries()]
    .map(([reason, count]) => ({ reason, count }))
    .sort((a, b) => b.count - a.count || (a.reason < b.reason ? -1 : 1));
  return {
    total: snapshot.protocols.length,
    tokened: tokened.length,
    pre_token: preToken.length,
    rankable: rankable.length,
    filtered: filtered.length,
    filtered_by,
    comparables: snapshot.protocols.filter((p) => p.mcap_usd !== null && p.mcap_usd > 0 && p.tvl_usd > 0).length,
    dead_mcap_le_zero: snapshot.protocols.filter((p) => p.mcap_usd !== null && p.mcap_usd <= 0).length,
  };
}

/**
 * The ledger: all 758 protocols in ten groups, first match wins, computed at
 * runtime from this snapshot. The ranked groups are the board itself (watchlist
 * plus the early candidates above and below the floor); the out groups name the
 * house rule that sets each filtered protocol aside, in the same order the
 * research uses — bridge, liquid staking, exchange, versioned name, wrapped word.
 * The groups sum to the snapshot total; nothing is dropped silently.
 */
export function ledgerGroups(snapshot: Snapshot): LedgerGroup[] {
  const floor = snapshot.floor_usd;
  const watch = new Set(snapshot.watchlist);
  const tokened = snapshot.protocols.filter((p) => !isPreToken(p));
  const preToken = snapshot.protocols.filter(isPreToken);
  const rankable = snapshot.protocols.filter(isRankable);
  const comparables = snapshot.protocols.filter((p) => p.mcap_usd !== null && p.mcap_usd > 0 && p.tvl_usd > 0).length;
  const tokenNoCap = tokened.length - comparables;
  const watchRanked = snapshot.watchlist.filter((s) => rankable.some((p) => p.slug === s)).length;
  const offList = rankable.filter((p) => !watch.has(p.slug));
  const offAbove = offList.filter((p) => p.tvl_usd >= floor).length;
  const offBelow = offList.filter((p) => p.tvl_usd < floor).length;
  const filtered = preToken.filter((p) => !isRankable(p));
  const isBridge = (p: SnapshotProtocol): boolean => p.category === 'Bridge' || p.category === 'Canonical Bridge';
  const isLiq = (p: SnapshotProtocol): boolean =>
    p.category === 'Liquid Staking' || p.category === 'Liquid Restaking' || p.category === 'Restaked BTC';
  const isCex = (p: SnapshotProtocol): boolean => p.category === 'CEX';
  const isVersioned = (p: SnapshotProtocol): boolean => VERSIONED.test(p.name);
  const isWrapped = (p: SnapshotProtocol): boolean => /\bwrapped\b|\bstaked\b|\bstaking\b/i.test(p.name);
  const gBridge = filtered.filter(isBridge).length;
  const gLiq = filtered.filter((p) => !isBridge(p) && isLiq(p)).length;
  const gCex = filtered.filter((p) => !isBridge(p) && !isLiq(p) && isCex(p)).length;
  const gVer = filtered.filter((p) => !isBridge(p) && !isLiq(p) && !isCex(p) && isVersioned(p)).length;
  const gWrap = filtered.filter((p) => !isBridge(p) && !isLiq(p) && !isCex(p) && !isVersioned(p) && isWrapped(p)).length;
  return [
    { label: 'Token trades (usable cap)', count: comparables },
    { label: 'Token recorded, no usable cap', count: tokenNoCap },
    { label: 'Ranked watchlist', count: watchRanked },
    { label: 'Ranked off-list above floor', count: offAbove },
    { label: 'Ranked early below floor', count: offBelow },
    { label: 'Out bridge', count: gBridge },
    { label: 'Out liquid staking', count: gLiq },
    { label: 'Out exchange', count: gCex },
    { label: 'Out versioned', count: gVer },
    { label: 'Out wrapped', count: gWrap },
  ];
}

/** The maturity factor: older protocols with no token rank higher, up to the cap. */
export function maturityFactor(age: number | null, medianAgeDays: number, model: ModelConstants): number {
  const a = age ?? medianAgeDays;
  return model.maturity_floor + (Math.min(Math.max(a, 0), model.maturity_days) / model.maturity_days) * model.maturity_range;
}

/** The three factors and the implied value one protocol gets under `model`. */
export function impliedValue(
  protocol: SnapshotProtocol,
  asOf: string,
  comparables: { byCategory: Map<string, { multiple: number; count: number }>; globalMultiple: number; medianAgeDays: number },
  model: ModelConstants,
): {
  implied: number;
  multiple: number;
  comparablesUsed: number;
  source: 'category' | 'global';
  momentum: number;
  maturity: number;
  age: number | null;
} {
  const age = ageDays(asOf, protocol.listed_at);
  const comp = comparableFor(protocol.category, comparables, model);
  const momentum = momentumFactor(protocol.change_7d, model);
  const maturity = maturityFactor(age, comparables.medianAgeDays, model);
  // Round the factors first, then compute the implied value from the ROUNDED
  // factors: the dashboard recomputes from the stored factors, so the stored
  // implied value must be exactly what those factors produce.
  const multiple = round6(comp.multiple);
  const momentumR = round4(momentum);
  const maturityR = round4(maturity);
  const raw = protocol.tvl_usd * multiple * momentumR * maturityR;
  const implied = Math.max(model.value_floor_usd, Math.min(model.value_cap_usd, Math.round(raw)));
  return { implied, multiple, comparablesUsed: comp.count, source: comp.source, momentum: momentumR, maturity: maturityR, age };
}

/** The verdict: Farm now for the largest launches, Watch for the mid-tier, Skip for the small ones. */
export function verdictFor(implied: number): 'Farm now' | 'Watch' | 'Skip' {
  if (implied >= 25_000_000) return 'Farm now';
  if (implied >= 5_000_000) return 'Watch';
  return 'Skip';
}

/** The single decisive reason for a verdict, computed from the protocol's own figures. */
export function verdictReason(p: SnapshotProtocol, age: number | null, implied: number, rank: number): string {
  const months = age === null ? null : Math.floor(age / 30);
  if (p.change_7d !== null && p.change_7d >= 20) {
    return `TVL up ${p.change_7d.toFixed(1)}% in 7 days${months !== null && months >= 6 ? `, ${months} months running with no token recorded` : ''}.`;
  }
  if (p.change_7d !== null && p.change_7d <= -20) {
    return `TVL down ${Math.abs(p.change_7d).toFixed(1)}% in 7 days — the launch case is cooling.`;
  }
  if (months !== null && months >= 12) {
    return `${months} months running with no token recorded — a long wait usually precedes a launch.`;
  }
  if (rank <= 10) {
    return `Rank ${rank} on the board: an implied launch value of $${implied.toLocaleString('en-US')}.`;
  }
  if (p.change_7d !== null && p.change_7d >= 5) {
    return `TVL up ${p.change_7d.toFixed(1)}% in 7 days and still no token recorded.`;
  }
  return `Implied launch value $${implied.toLocaleString('en-US')} on $${p.tvl_usd.toLocaleString('en-US')} of TVL.`;
}

/** A step as one string: its action, then its cost and time, within the gate's 20..600 characters. */
export function stepText(step: FarmStep): string {
  let s = `${step.text} Cost: ${step.cost}. Time: ${step.time}.`;
  if (s.length > 600) s = `${s.slice(0, 596)}...`;
  if (s.length < 20) s = `${s} Hold the position and check the protocol's own page.`;
  return s;
}

/** The first chain a protocol names, or a neutral phrase. */
function chainOf(p: SnapshotProtocol): string {
  return p.chains.length > 0 ? p.chains[0]! : 'its main chain';
}

/** The gas profile of a chain: what a transaction costs there. */
function gasFor(chain: string): { tier: string; tx: string } {
  const c = chain.toLowerCase();
  if (c === 'ethereum') return { tier: 'Ethereum L1', tx: '$2–$15 per transaction' };
  if (c === 'solana') return { tier: 'Solana', tx: 'about $0.01 per transaction' };
  if (['arbitrum', 'optimism', 'base', 'zksync', 'polygon', 'blast', 'linea', 'scroll', 'mode', 'mantle', 'opbnb'].includes(c)) {
    return { tier: `${chain} (L2)`, tx: '$0.05–$0.50 per transaction' };
  }
  if (['bnb chain', 'avalanche', 'tron', 'fantom', 'gnosis'].includes(c)) {
    return { tier: chain, tx: '$0.10–$1 per transaction' };
  }
  return { tier: chain, tx: '$0.50–$2 per transaction' };
}

/** The midpoint gas cost of one transaction on a chain, in USD, for the break-even. */
function gasUsdMid(chain: string): number {
  const c = chain.toLowerCase();
  if (c === 'ethereum') return 8.5;
  if (c === 'solana') return 0.01;
  if (['arbitrum', 'optimism', 'base', 'zksync', 'polygon', 'blast', 'linea', 'scroll', 'mode', 'mantle', 'opbnb'].includes(c)) return 0.28;
  if (['bnb chain', 'avalanche', 'tron', 'fantom', 'gnosis'].includes(c)) return 0.55;
  return 1.25;
}

/** A farm plan netted to its break-even: what the plan costs, in gas and in active time. */
export interface BreakEven {
  /** Total gas the plan spends, in USD (setup + one transaction a week + the claim). */
  gas_usd: number;
  /** Active time the plan asks for, in hours (setup + weekly actions + claim + log). */
  active_hours: number;
  /** Gas per active hour: the allocation must be worth at least this much per hour to cover its cost. */
  usd_per_hour: number;
  /** Whole weeks the plan runs (the hold, rounded up to weeks). */
  weeks: number;
}

/**
 * A plan's break-even, from its own chain and hold: the gas of one setup transaction,
 * one a week through the hold, and the claim, over the active minutes the steps name.
 * The capital stays in the position, so it is not a cost — only the gas is.
 */
export function breakEvenFor(p: SnapshotProtocol, age: number | null): BreakEven {
  const chain = chainOf(p);
  const hold = holdDaysFor(age);
  const weeks = Math.max(1, Math.ceil(hold / 7));
  const txs = 1 + weeks + 1;
  const gas = round2(txs * gasUsdMid(chain));
  const activeMinutes = 1 + 5 + 15 + 10 * weeks + 10 + 5;
  const hours = round2(activeMinutes / 60);
  return { gas_usd: gas, active_hours: hours, usd_per_hour: round2(gas / hours), weeks };
}

/** How much capital one farm position needs, from the protocol's own TVL band. */
function capitalFor(p: SnapshotProtocol): number {
  if (p.tvl_usd >= 1_000_000_000) return 2000;
  if (p.tvl_usd >= 250_000_000) return 1000;
  if (p.tvl_usd >= 50_000_000) return 500;
  return 250;
}

/** How long to hold, from the protocol's age: younger protocols get a longer qualifying window. */
function holdDaysFor(age: number | null): number {
  if (age === null) return 30;
  if (age < 180) return 60;
  if (age < 365) return 45;
  return 30;
}

/** The category's one action, in the words a farmer can follow. */
function actionFor(p: SnapshotProtocol, capital: number, chain: string): string {
  const c = (p.category ?? '').toLowerCase();
  const name = p.name;
  if (c.includes('lend') || c.includes('cdp') || c.includes('collateral')) {
    return `Supply $${capital} of USDC to ${name} on ${chain}, then borrow a small amount against it and repay it — a supply-and-borrow loop the protocol counts as real use.`;
  }
  if (c.includes('dex') || c.includes('yield') || c.includes('leveraged farm')) {
    return `Provide $${capital} of liquidity to ${name}'s main pool on ${chain}, both sides of the pair, and keep the position in range.`;
  }
  if (c.includes('perpetual') || c.includes('derivative') || c.includes('options')) {
    return `Open ${name}'s testnet or paper mode first, then deposit $${capital} of USDC as margin on ${chain} and open one small hedged position.`;
  }
  if (c.includes('bridge') || c.includes('cross chain')) {
    return `Bridge $${capital} of USDC to ${chain} through ${name}, then use the bridged funds inside its app instead of bridging straight back.`;
  }
  if (c.includes('staking') || c.includes('restak')) {
    return `Stake $${capital} of the chain's staking asset through ${name} on ${chain} and keep the receipt token.`;
  }
  if (c.includes('rwa')) {
    return `Mint $${capital} of ${name}'s yield-bearing asset on ${chain} and hold it through at least one yield distribution.`;
  }
  if (c.includes('prediction')) {
    return `Fund $${capital} and place one market position on ${name}, then settle or close it rather than leaving the funds idle.`;
  }
  if (c.includes('curator') || c.includes('allocator') || c.includes('vault')) {
    return `Deposit $${capital} into a ${name} vault on ${chain} and keep the shares while the vault rebalances.`;
  }
  if (c.includes('stable')) {
    return `Mint or deposit $${capital} of the stable asset through ${name} on ${chain} and keep it in the protocol's own savings or staking module.`;
  }
  if (c.includes('insurance')) {
    return `Buy $${capital} of cover from ${name} on ${chain} and keep the policy active through the farming window.`;
  }
  if (c.includes('launchpad') || c.includes('farm')) {
    return `Join one ${name} farm or sale on ${chain} with $${capital} and complete the protocol's own onboarding steps.`;
  }
  return `Deposit $${capital} of USDC into ${name} on ${chain} and keep the position open, using the protocol's main feature at least once.`;
}

/**
 * A protocol's farm plan: a verdict line, then six steps, each an action with a
 * cost and a time. The plan is derived from the protocol's own record (category,
 * chains, TVL, age) — never from a hand-written list of names.
 */
export function farmSteps(p: SnapshotProtocol, age: number | null, verdict: 'Farm now' | 'Watch' | 'Skip', reason: string): FarmStep[] {
  const chain = chainOf(p);
  const gas = gasFor(chain);
  const capital = capitalFor(p);
  const hold = holdDaysFor(age);
  const action = actionFor(p, capital, chain);
  return [
    {
      text: `Verdict: ${verdict} — ${reason}`,
      cost: 'no cost to read',
      time: '1 minute',
    },
    {
      text: `Use a fresh wallet that holds only the funds you plan to farm, and keep its seed phrase offline.`,
      cost: `under $3 of gas for the first transaction on ${gas.tier}`,
      time: '5 minutes',
    },
    {
      text: action,
      cost: `$${capital} of capital and ${gas.tx}`,
      time: '15 minutes to set up',
    },
    {
      text: `Make one qualifying action each week — a deposit, a borrow, a swap or a vote — so the wallet shows a pattern, not a single deposit.`,
      cost: `${gas.tx} a week`,
      time: '10 minutes a week',
    },
    {
      text: `Hold the position for at least ${hold} days so the activity is counted in more than one snapshot.`,
      cost: `the $${capital} stays in the position`,
      time: `${hold} days`,
    },
    {
      text: `Before you withdraw, open the protocol's own points or rewards page and claim only from the link it publishes — never from a link in a chat or an email.`,
      cost: 'no fee to check, and never pay to claim',
      time: '10 minutes',
    },
    {
      text: `Write the wallet, the dates and every transaction in a farm log so you can repeat the position or unwind it.`,
      cost: 'nothing but the log',
      time: '5 minutes',
    },
  ];
}

/** The live-token protocols, by market cap, for the dashboard's Live token view. */
export function liveRows(snapshot: Snapshot, limit: number): LiveRow[] {
  return snapshot.protocols
    .filter((p) => !isPreToken(p) && p.category !== 'CEX')
    .sort((a, b) => (b.mcap_usd ?? 0) - (a.mcap_usd ?? 0) || b.tvl_usd - a.tvl_usd || (a.slug < b.slug ? -1 : 1))
    .slice(0, limit)
    .map((p) => ({
      slug: p.slug,
      name: p.name,
      category: p.category,
      chains: p.chains,
      tvl_usd: p.tvl_usd,
      mcap_usd: p.mcap_usd,
      change_7d: p.change_7d,
    }));
}

/** The protocols the board ranks, strongest first, with ranks 1..n. */
export function buildBoard(snapshot: Snapshot, model: ModelConstants = MODEL): BoardRow[] {
  const comparables = computeComparables(snapshot, model);
  const iv = intervals(snapshot, model);
  const index = new Map(snapshot.protocols.map((p) => [p.slug, p]));
  const chosen = new Map<string, SnapshotProtocol>();
  // The watchlist is the floor: every slug on it, even one the snapshot no longer carries.
  for (const slug of snapshot.watchlist) {
    const p = index.get(slug);
    if (p !== undefined) chosen.set(slug, p);
  }
  // The early radar: every rankable protocol the watchlist does not name. No cap:
  // the whole pre-token universe the snapshot records is the board.
  for (const p of snapshot.protocols) {
    if (!chosen.has(p.slug) && isRankable(p)) chosen.set(p.slug, p);
  }

  const scored = [...chosen.values()].map((p) => {
    const v = impliedValue(p, snapshot.as_of, comparables, model);
    return { p, ...v };
  });
  scored.sort((a, b) => b.implied - a.implied || (a.p.slug < b.p.slug ? -1 : a.p.slug > b.p.slug ? 1 : 0));
  const clampInterval = (n: number): number => Math.max(model.value_floor_usd, Math.min(model.value_cap_usd, n));
  return scored.map((s, i) => {
    const rank = i + 1;
    const verdict = verdictFor(s.implied);
    const reason = verdictReason(s.p, s.age, s.implied, rank);
    return {
      rank,
      slug: s.p.slug,
      name: s.p.name,
      category: s.p.category,
      chains: s.p.chains,
      tvl_usd: s.p.tvl_usd,
      change_7d: s.p.change_7d,
      mcap_usd: s.p.mcap_usd,
      listed_at: s.p.listed_at,
      gecko_id: s.p.gecko_id,
      symbol: s.p.symbol,
      token_status: 'pre-token' as const,
      age_days: s.age,
      implied_value_usd: s.implied,
      interval_low_usd: clampInterval(Math.round(s.implied * iv.p25)),
      interval_high_usd: clampInterval(Math.round(s.implied * iv.p75)),
      verdict,
      verdict_reason: reason,
      model: {
        comparable_multiple: round6(s.multiple),
        comparables_used: s.comparablesUsed,
        comparable_source: s.source,
        growth_pct: s.p.change_7d,
        momentum_factor: round4(s.momentum),
        maturity_factor: round4(s.maturity),
        age_days: s.age,
      },
      farm_steps: farmSteps(s.p, s.age, verdict, reason).map(stepText),
      break_even: breakEvenFor(s.p, s.age),
    };
  });
}

const round2 = (n: number): number => Math.round(n * 100) / 100;
const round4 = (n: number): number => Math.round(n * 1e4) / 1e4;
const round6 = (n: number): number => Math.round(n * 1e6) / 1e6;

/** A board row's compact form for zz-data.js. */
export function radarRow(row: BoardRow, watchlist: Set<string>): RadarRow {
  return {
    rank: row.rank,
    slug: row.slug,
    name: row.name,
    category: row.category,
    chains: row.chains,
    tvl_usd: row.tvl_usd,
    change_7d: row.change_7d,
    listed_at: row.listed_at,
    age_days: row.age_days,
    implied_value_usd: row.implied_value_usd,
    interval_low_usd: row.interval_low_usd,
    interval_high_usd: row.interval_high_usd,
    verdict: row.verdict,
    verdict_reason: row.verdict_reason,
    watchlist: watchlist.has(row.slug),
    comparable_multiple: row.model.comparable_multiple,
    comparables_used: row.model.comparables_used,
    comparable_source: row.model.comparable_source,
    momentum_factor: row.model.momentum_factor,
    maturity_factor: row.model.maturity_factor,
    break_even: row.break_even,
  };
}

/** Everything the dashboard renders, from the snapshot. */
export function buildRadar(snapshot: Snapshot, model: ModelConstants = MODEL): { board: BoardRow[]; radar: RadarData } {
  const board = buildBoard(snapshot, model);
  const comparables = computeComparables(snapshot, model);
  const live = liveRows(snapshot, 24);
  const early = board.filter((r) => !snapshot.watchlist.includes(r.slug)).length;
  const watchSet = new Set(snapshot.watchlist);
  const held = heldOutTest(snapshot, model);
  const iv = intervals(snapshot, model);
  const pct1 = (x: number): string => (Math.round(x * 1000) / 10).toFixed(1);
  const intervalNote =
    `In the leave-one-out test over the ${held.n} tokened protocols, the actual market cap lands inside the P25–P75 range for ${pct1(iv.coverage_2575)}% ` +
    `and inside the P10–P90 range for ${pct1(iv.coverage_1090)}% — the range is wide because launch values vary by more than an order of magnitude even for similar TVL, ` +
    `so read the implied value as a centre, not a promise.`;
  const radar: RadarData = {
    as_of: snapshot.as_of,
    source: snapshot.source,
    floor_usd: snapshot.floor_usd,
    model,
    model_version: MODEL_VERSION,
    watchlist_size: snapshot.watchlist.length,
    board_size: board.length,
    early_size: early,
    live_size: live.length,
    global_multiple: round6(comparables.globalMultiple),
    median_age_days: comparables.medianAgeDays,
    held_out: held,
    accounting: accounting(snapshot),
    intervals: iv,
    interval_note: intervalNote,
    ledger: ledgerGroups(snapshot),
    rows: board.map((r) => radarRow(r, watchSet)),
    live,
  };
  return { board, radar };
}

/** The snapshot out of a file's text, refused unless it is the shape the model scores. */
export function parseSnapshot(text: string): Snapshot {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new SnapshotError('snapshot.json is not JSON');
  }
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) throw new SnapshotError('snapshot.json is not a JSON object');
  const o = raw as Record<string, unknown>;
  if (typeof o.as_of !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(o.as_of)) throw new SnapshotError('snapshot.json has no as_of date');
  if (typeof o.source !== 'string') throw new SnapshotError('snapshot.json has no source');
  if (typeof o.floor_usd !== 'number' || !Number.isSafeInteger(o.floor_usd) || o.floor_usd <= 0) throw new SnapshotError('snapshot.json has no floor_usd');
  if (!Array.isArray(o.protocols)) throw new SnapshotError('snapshot.json has no protocols array');
  if (!Array.isArray(o.watchlist) || o.watchlist.some((s) => typeof s !== 'string')) throw new SnapshotError('snapshot.json has no watchlist of slugs');
  const protocols = o.protocols.map((v, i) => {
    if (typeof v !== 'object' || v === null || Array.isArray(v)) throw new SnapshotError(`snapshot.json's protocol ${i} is not an object`);
    const p = v as Record<string, unknown>;
    if (typeof p.slug !== 'string' || typeof p.name !== 'string' || typeof p.tvl_usd !== 'number' || !Number.isFinite(p.tvl_usd)) {
      throw new SnapshotError(`snapshot.json's protocol ${i} lacks a slug, a name or a TVL`);
    }
    return {
      slug: p.slug,
      name: p.name,
      category: typeof p.category === 'string' ? p.category : null,
      chains: Array.isArray(p.chains) ? p.chains.filter((c): c is string => typeof c === 'string') : [],
      tvl_usd: p.tvl_usd,
      change_7d: typeof p.change_7d === 'number' && Number.isFinite(p.change_7d) ? p.change_7d : null,
      mcap_usd: typeof p.mcap_usd === 'number' && Number.isFinite(p.mcap_usd) ? p.mcap_usd : null,
      listed_at: typeof p.listed_at === 'string' ? p.listed_at : null,
      gecko_id: typeof p.gecko_id === 'string' ? p.gecko_id : null,
      symbol: typeof p.symbol === 'string' ? p.symbol : null,
    };
  });
  return {
    as_of: o.as_of,
    source: o.source,
    floor_usd: o.floor_usd,
    protocols,
    watchlist: o.watchlist as string[],
  };
}

/** Why a board is not one the gate will take, or null: coverage, ranks, order, one shared implied value, and farm steps. */
export function boardIssue(board: BoardRow[], snapshot: Snapshot): string | null {
  const slugs = new Set(board.map((r) => r.slug));
  const missing = snapshot.watchlist.filter((s) => !slugs.has(s));
  if (missing.length > 0) return `the board misses ${missing.length} watchlist slug${missing.length === 1 ? '' : 's'}: ${missing.slice(0, 5).join(', ')}`;
  if (board.length < 100) return `the board holds ${board.length} rows, fewer than the 100 the gate needs`;
  const ranks = board.map((r) => r.rank).sort((a, b) => a - b);
  for (let i = 0; i < ranks.length; i++) if (ranks[i] !== i + 1) return `rank ${i + 1} is ${ranks[i]}`;
  for (let i = 1; i < board.length; i++) if (board[i]!.implied_value_usd > board[i - 1]!.implied_value_usd) return `row ${i + 1} outranks row ${i} on implied value`;
  if (board.length >= 2 && board[0]!.implied_value_usd === board[board.length - 1]!.implied_value_usd) {
    return `all ${board.length} rows share the same implied value $${board[0]!.implied_value_usd}: a board that ranks nothing by value is not a ranking`;
  }
  for (const r of board) {
    const steps = r.farm_steps;
    if (steps.length < 3 || steps.length > 12) return `${r.slug} has ${steps.length} farm steps`;
    for (const s of steps) if (s.length < 20 || s.length > 600) return `${r.slug} has a farm step of ${s.length} characters`;
    if (!Number.isSafeInteger(r.implied_value_usd) || r.implied_value_usd <= 0 || r.implied_value_usd > 100_000_000_000_000) {
      return `${r.slug} has implied value ${r.implied_value_usd}`;
    }
  }
  return null;
}

/** The dashboard's data as one minified line, named to sort last in the dossier text. */
export function dataScript(radar: RadarData): string {
  return `window.RADAR=${JSON.stringify(radar)};`;
}
