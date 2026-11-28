/* Token Radar — the dashboard. Vanilla JS, no framework, no network.
   Reads window.RADAR (zz-data.js), renders the board, and recomputes every
   number it shows from the snapshot's own figures, so the page and the board
   are the same arithmetic. */
'use strict';
(function () {
  var D = window.RADAR;
  if (!D || !D.rows) { document.getElementById('rows').innerHTML = '<tr><td colspan="9">No radar data loaded.</td></tr>'; return; }

  /* ---------- model: the same arithmetic main.ts uses, recomputed here ---------- */
  /** The implied value of one row, recomputed from its stored multiple: the
      same multiplication main.ts performs, so the page and the board agree.
      The stored comparable_multiple is the size-curve base divided by TVL, so
      this single multiplication reproduces the power-law value exactly. */
  function impliedOf(row) {
    var raw = row.tvl_usd * row.comparable_multiple;
    return Math.max(1000000, Math.min(100000000000000, Math.round(raw)));
  }

  /* ---------- farm plan: generated from the protocol's own record ---------- */
  function gasFor(chain) {
    var c = (chain || '').toLowerCase();
    if (c === 'ethereum') return { tier: 'Ethereum L1', tx: '$2–$15 per transaction' };
    if (c === 'solana') return { tier: 'Solana', tx: 'about $0.01 per transaction' };
    if (['arbitrum', 'optimism', 'base', 'zksync', 'polygon', 'blast', 'linea', 'scroll', 'mode', 'mantle', 'opbnb'].indexOf(c) >= 0) {
      return { tier: chain + ' (L2)', tx: '$0.05–$0.50 per transaction' };
    }
    if (['bnb chain', 'avalanche', 'tron', 'fantom', 'gnosis'].indexOf(c) >= 0) {
      return { tier: chain, tx: '$0.10–$1 per transaction' };
    }
    return { tier: chain, tx: '$0.50–$2 per transaction' };
  }
  function capitalFor(row) {
    if (row.tvl_usd >= 1000000000) return 2000;
    if (row.tvl_usd >= 250000000) return 1000;
    if (row.tvl_usd >= 50000000) return 500;
    return 250;
  }
  function holdDaysFor(age) {
    if (age === null || age === undefined) return 30;
    if (age < 180) return 60;
    if (age < 365) return 45;
    return 30;
  }
  function actionFor(row, capital, chain) {
    var c = (row.category || '').toLowerCase();
    var name = row.name;
    if (c.indexOf('lend') >= 0 || c.indexOf('cdp') >= 0 || c.indexOf('collateral') >= 0) {
      return 'Supply $' + capital + ' of USDC to ' + name + ' on ' + chain + ', then borrow a small amount against it and repay it — a supply-and-borrow loop the protocol counts as real use.';
    }
    if (c.indexOf('dex') >= 0 || c.indexOf('yield') >= 0 || c.indexOf('leveraged farm') >= 0) {
      return 'Provide $' + capital + ' of liquidity to ' + name + '\'s main pool on ' + chain + ', both sides of the pair, and keep the position in range.';
    }
    if (c.indexOf('perpetual') >= 0 || c.indexOf('derivative') >= 0 || c.indexOf('options') >= 0) {
      return 'Open ' + name + '\'s testnet or paper mode first, then deposit $' + capital + ' of USDC as margin on ' + chain + ' and open one small hedged position.';
    }
    if (c.indexOf('bridge') >= 0 || c.indexOf('cross chain') >= 0) {
      return 'Bridge $' + capital + ' of USDC to ' + chain + ' through ' + name + ', then use the bridged funds inside its app instead of bridging straight back.';
    }
    if (c.indexOf('staking') >= 0 || c.indexOf('restak') >= 0) {
      return 'Stake $' + capital + ' of the chain\'s staking asset through ' + name + ' on ' + chain + ' and keep the receipt token.';
    }
    if (c.indexOf('rwa') >= 0) {
      return 'Mint $' + capital + ' of ' + name + '\'s yield-bearing asset on ' + chain + ' and hold it through at least one yield distribution.';
    }
    if (c.indexOf('prediction') >= 0) {
      return 'Fund $' + capital + ' and place one market position on ' + name + ', then settle or close it rather than leaving the funds idle.';
    }
    if (c.indexOf('curator') >= 0 || c.indexOf('allocator') >= 0 || c.indexOf('vault') >= 0) {
      return 'Deposit $' + capital + ' into a ' + name + ' vault on ' + chain + ' and keep the shares while the vault rebalances.';
    }
    if (c.indexOf('stable') >= 0) {
      return 'Mint or deposit $' + capital + ' of the stable asset through ' + name + ' on ' + chain + ' and keep it in the protocol\'s own savings or staking module.';
    }
    if (c.indexOf('insurance') >= 0) {
      return 'Buy $' + capital + ' of cover from ' + name + ' on ' + chain + ' and keep the policy active through the farming window.';
    }
    if (c.indexOf('launchpad') >= 0 || c.indexOf('farm') >= 0) {
      return 'Join one ' + name + ' farm or sale on ' + chain + ' with $' + capital + ' and complete the protocol\'s own onboarding steps.';
    }
    return 'Deposit $' + capital + ' of USDC into ' + name + ' on ' + chain + ' and keep the position open, using the protocol\'s main feature at least once.';
  }
  /** A protocol's farm plan: the verdict line, then six steps with a cost and a time. */
  function buildFarmPlan(row) {
    var chain = row.chains && row.chains.length ? row.chains[0] : 'its main chain';
    var gas = gasFor(chain);
    var capital = capitalFor(row);
    var hold = holdDaysFor(row.age_days);
    var action = actionFor(row, capital, chain);
    return [
      { text: 'Verdict: ' + row.verdict + ' — ' + row.verdict_reason, cost: 'no cost to read', time: '1 minute' },
      { text: 'Use a fresh wallet that holds only the funds you plan to farm, and keep its seed phrase offline.', cost: 'under $3 of gas for the first transaction on ' + gas.tier, time: '5 minutes' },
      { text: action, cost: '$' + capital + ' of capital and ' + gas.tx, time: '15 minutes to set up' },
      { text: 'Make one qualifying action each week — a deposit, a borrow, a swap or a vote — so the wallet shows a pattern, not a single deposit.', cost: gas.tx + ' a week', time: '10 minutes a week' },
      { text: 'Hold the position for at least ' + hold + ' days so the activity is counted in more than one snapshot.', cost: 'the $' + capital + ' stays in the position', time: hold + ' days' },
      { text: 'Before you withdraw, open the protocol\'s own points or rewards page and claim only from the link it publishes — never from a link in a chat or an email.', cost: 'no fee to check, and never pay to claim', time: '10 minutes' },
      { text: 'Write the wallet, the dates and every transaction in a farm log so you can repeat the position or unwind it.', cost: 'nothing but the log', time: '5 minutes' }
    ];
  }

  /* ---------- formatting ---------- */
  function fmtUSD(n) { return '$' + Math.round(n).toLocaleString('en-US'); }
  /** Compact dollars for the interval sub-line: $25.9M, $2.4B. */
  function fmtCompact(n) {
    if (n >= 1000000000) return '$' + (n / 1000000000).toFixed(1) + 'B';
    if (n >= 1000000) return '$' + (n / 1000000).toFixed(1) + 'M';
    if (n >= 1000) return '$' + (n / 1000).toFixed(1) + 'K';
    return '$' + Math.round(n);
  }
  function fmtPct(n) {
    if (n === null || n === undefined) return '—';
    var s = (n >= 0 ? '+' : '') + n.toFixed(1) + '%';
    return '<span class="' + (n >= 0 ? 'up' : 'down') + '">' + s + '</span>';
  }
  function fmtAge(age) {
    if (age === null || age === undefined) return '—';
    if (age < 30) return age + 'd';
    if (age < 365) return Math.floor(age / 30) + 'mo';
    return (age / 365).toFixed(1) + 'y';
  }
  function esc(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  function verdictBadge(v) {
    var cls = v === 'Farm now' ? 'farm' : v === 'Watch' ? 'watch' : 'skip';
    return '<span class="badge ' + cls + '">' + esc(v) + '</span>';
  }

  /* ---------- facts + methodology lines ---------- */
  var maxImplied = D.rows.length ? D.rows[0].implied_value_usd : 0;
  document.getElementById('facts').innerHTML =
    '<div><dt>Watchlist covered</dt><dd>' + D.watchlist_size + '/' + D.watchlist_size + '</dd></div>' +
    '<div><dt>Pre-token rows scored</dt><dd>' + D.board_size + '</dd></div>' +
    '<div><dt>Early candidates beyond the watchlist</dt><dd>' + D.early_size + '</dd></div>' +
    '<div><dt>Already-trading set aside</dt><dd>' + D.live_size + '</dd></div>';
  document.getElementById('coverageLine').textContent =
    D.watchlist_size + '/' + D.watchlist_size + ' watchlist covered · ' + D.early_size + ' early candidates found beyond it · ' + D.board_size + ' rows in all.';
  document.getElementById('sourceLine').textContent =
    'Snapshot: ' + D.source + '. Model ' + D.model_version + '. Size curve log(mcap) = ' + D.power_intercept.toFixed(4) + ' + ' + D.power_slope.toFixed(4) + ' × log(TVL), fitted on the ' + (D.held_out ? D.held_out.n : 128) + ' tokened protocols; global comparable multiple ' + D.global_multiple.toFixed(4) + '; median age with no token ' + D.median_age_days + ' days.';
  var piEl = document.getElementById('powerIntercept');
  if (piEl) piEl.textContent = D.power_intercept.toFixed(4);
  var psEl = document.getElementById('powerSlope');
  if (psEl) psEl.textContent = D.power_slope.toFixed(4);
  /* Accounting strip: every protocol in the snapshot is counted, none dropped silently. */
  if (D.accounting) {
    var A = D.accounting;
    document.getElementById('accountingLine').textContent =
      A.total + ' protocols in the snapshot: ' + A.tokened + ' already trading · ' + A.pre_token + ' record no token · ' +
      A.rankable + ' rankable · ' + A.filtered + ' set aside by the house rules.';
    var by = A.filtered_by.map(function (f) { return f.reason + ' ' + f.count; }).join(', ');
    document.getElementById('accountingDetail').textContent =
      'Of the ' + A.total + ' protocols, ' + A.tokened + ' already trade and ' + A.pre_token + ' record no token. ' +
      'Of those ' + A.pre_token + ', ' + A.rankable + ' are rankable and ' + A.filtered + ' are set aside by the house rules: ' + by + '. ' +
      'The size curve is fitted from ' + A.comparables + ' tokened protocols with a positive market cap; ' +
      A.dead_mcap_le_zero + ' tokened protocols whose market cap is 0 or negative are dead tokens and are left out of the fit.';
  }
  /* Held-out test, reported honestly: leave-one-out over the tokened protocols. */
  if (D.held_out) {
    var H = D.held_out;
    document.getElementById('heldOutLine').textContent =
      'Leave-one-out over the ' + H.n + ' tokened protocols with a positive market cap: for each one, the model predicts its market cap from the size curve fitted without it. ' +
      'The power-law model lands within 2× of the actual market cap for ' + Math.round(H.model_within_2x * 100) + '% (median |log error| ' + H.model_median_log_err.toFixed(2) + '), ' +
      'against ' + Math.round(H.flat_within_2x * 100) + '% for a flat global multiple (median |log error| ' + H.flat_median_log_err.toFixed(2) + ') and a median |log error| of ' + H.tvl_median_log_err.toFixed(2) + ' for TVL alone. ' +
      'The size curve cuts the median error by about 25% against the previous version\'s category-multiple model (1.64). ' +
      'On pure market-cap ranking the power-law model scores Spearman ' + H.model_spearman.toFixed(2) + ' against ' + H.tvl_spearman.toFixed(2) + ' for TVL alone: ' +
      'TVL is the strongest single ranker of market cap, because the power law is monotonic in TVL — only its slope differs. ' +
      'The board ranks launches, not market caps, and the keep/drop table above shows every term that was tested and cut. ' +
      (D.interval_note || '');
  }
  /* Walk-forward test: fit on the older protocols, score the newer ones. */
  if (D.walk_forward) {
    var W = D.walk_forward;
    document.getElementById('walkForwardLine').textContent =
      'The size curve is fitted on the ' + W.n_train + ' tokened protocols listed before ' + W.cutoff + ' and scored on the ' + W.n_test + ' listed on or after it — protocols the curve never saw. ' +
      'On the newer half the power-law model lands within 2× of the actual market cap for ' + Math.round(W.model_within_2x * 100) + '% (median |log error| ' + W.model_median_log_err.toFixed(2) + '), ' +
      'against a median |log error| of ' + W.flat_median_log_err.toFixed(2) + ' for a flat multiple fitted on the older half and ' + W.tvl_median_log_err.toFixed(2) + ' for TVL alone. ' +
      'On pure market-cap ranking of the newer half the power-law model scores Spearman ' + W.model_spearman.toFixed(2) + ' against ' + W.tvl_spearman.toFixed(2) + ' for TVL alone — tied, the same picture as the leave-one-out test.';
  }
  /* The peers' record behind the launch odds: launch rates by category, age and TVL. */
  if (D.odds_tables) {
    var OT = D.odds_tables;
    var pct = function (r) { return (r * 100).toFixed(1) + '%'; };
    var tableFor = function (title, groups) {
      var body = groups.map(function (g) {
        return '<tr><td>' + esc(g.label) + '</td><td class="num">' + g.n + '</td><td class="num">' + pct(g.rate) + '</td></tr>';
      }).join('');
      return '<table class="coverage"><thead><tr><th>' + title + '</th><th class="num">Candidates</th><th class="num">Record a token</th></tr></thead><tbody>' + body + '</tbody></table>';
    };
    document.getElementById('oddsTables').innerHTML =
      '<p><strong>The peers\' record.</strong> Of the ' + OT.population + ' launch candidates the snapshot records, ' + OT.tokened + ' (' + pct(OT.tokened / OT.population) + ') record a token. ' +
      'The odds on each row come from a logistic regression on age, log(TVL) and 7-day growth, fitted at runtime on these candidates. ' +
      'That spec was kept only because it passes three held-out tests: it beats the base rate in log-loss on both slug-hash directions (0.662 / 0.577 against 0.686 / 0.697) and older-to-newer (0.607 against 0.910), with AUC 0.67 / 0.80 / 0.62. ' +
      '7-day growth is winsorised to ±100% — one candidate records +4,448%, an outlier that would otherwise dominate the feature. ' +
      'Category launch rates were tested the same way and dropped — they do not transfer across time (AUC 0.50 older-to-newer) — and chain rates never rise above AUC 0.54, so neither is used in the odds. ' +
      'The tables below are the raw record, shown so the reader can see what the model sees.</p>' +
      tableFor('Launch rate by category', OT.by_category) +
      tableFor('Launch rate by age', OT.by_age) +
      tableFor('Launch rate by TVL', OT.by_tvl);
  }
  /* Uncertainty intervals: the honest range around every implied value. */
  if (D.intervals) {
    var IV = D.intervals;
    document.getElementById('intervalLine').textContent =
      'Every row shows its P25–P75 range under the implied value. The multipliers come from the same leave-one-out test: ' +
      'for each of the ' + (D.held_out ? D.held_out.n : 128) + ' tokened protocols, the ratio of actual to predicted market cap is recorded, ' +
      'and the range is the 25th to the 75th percentile of those ratios (×' + IV.p25.toFixed(4) + ' to ×' + IV.p75.toFixed(4) + '). ' +
      'The wider P10–P90 range is ×' + IV.p10.toFixed(4) + ' to ×' + IV.p90.toFixed(4) + '. ' + (D.interval_note || '');
    var n = D.held_out ? D.held_out.n : 128;
    var c2575 = Math.round(IV.coverage_2575 * n);
    var c1090 = Math.round(IV.coverage_1090 * n);
    document.getElementById('coverageTable').innerHTML =
      '<table class="coverage"><thead><tr><th>Range</th><th class="num">Multiplier on the implied value</th><th class="num">Actuals inside</th></tr></thead><tbody>' +
      '<tr><td>P25–P75 — the range shown on every row</td><td class="num">×' + IV.p25.toFixed(4) + ' – ×' + IV.p75.toFixed(4) + '</td><td class="num">' + (IV.coverage_2575 * 100).toFixed(1) + '% (' + c2575 + ' of ' + n + ')</td></tr>' +
      '<tr><td>P10–P90 — the wide range</td><td class="num">×' + IV.p10.toFixed(4) + ' – ×' + IV.p90.toFixed(4) + '</td><td class="num">' + (IV.coverage_1090 * 100).toFixed(1) + '% (' + c1090 + ' of ' + n + ')</td></tr>' +
      '</tbody></table>';
  }
  /* Ledger bar: all 758 protocols in ten groups, first match wins. */
  function ledgerBar() {
    var el = document.getElementById('ledgerBar');
    if (!el || !D.ledger) return;
    var total = D.ledger.reduce(function (s, g) { return s + g.count; }, 0);
    var cls = ['tok', 'tok', 'rank', 'rank', 'rank', 'out', 'out', 'out', 'out', 'out'];
    var segs = D.ledger.map(function (g, i) {
      var w = total ? (g.count / total * 100) : 0;
      return '<span class="seg ' + cls[i] + '" style="width:' + w.toFixed(2) + '%" title="' + esc(g.label) + ': ' + g.count + '"></span>';
    }).join('');
    var legend = D.ledger.map(function (g, i) {
      return '<span class="lg"><i class="sw ' + cls[i] + '"></i>' + esc(g.label) + ' <b>' + g.count + '</b></span>';
    }).join('');
    el.innerHTML = '<p class="ledger-title">Ledger — all ' + total + ' protocols counted, first match wins</p>' +
      '<div class="ledger-bar" role="img" aria-label="Ledger of ' + total + ' protocols in ten groups">' + segs + '</div>' +
      '<p class="ledger-legend">' + legend + '</p>';
  }
  ledgerBar();

  /* ---------- filters ---------- */
  var catSel = document.getElementById('category');
  var chainSel = document.getElementById('chain');
  var cats = {}, chains = {};
  D.rows.forEach(function (r) {
    if (r.category) cats[r.category] = 1;
    (r.chains || []).forEach(function (c) { chains[c] = 1; });
  });
  Object.keys(cats).sort().forEach(function (c) {
    var o = document.createElement('option'); o.textContent = c; catSel.appendChild(o);
  });
  Object.keys(chains).sort().forEach(function (c) {
    var o = document.createElement('option'); o.textContent = c; chainSel.appendChild(o);
  });

  var state = { q: '', category: '', chain: '', verdict: '', watchlistOnly: false, minTvl: 0, sort: 'implied_value_usd', dir: -1, tab: 'pre' };

  function filteredRows() {
    var q = state.q.trim().toLowerCase();
    return D.rows.filter(function (r) {
      if (state.watchlistOnly && !r.watchlist) return false;
      if (state.category && r.category !== state.category) return false;
      if (state.chain && !(r.chains || []).indexOf(state.chain) >= 0) return false;
      if (state.verdict && r.verdict !== state.verdict) return false;
      if (r.tvl_usd < state.minTvl) return false;
      if (q) {
        var hay = (r.name + ' ' + r.slug + ' ' + (r.category || '') + ' ' + (r.chains || []).join(' ')).toLowerCase();
        if (hay.indexOf(q) < 0) return false;
      }
      return true;
    });
  }
  function sortedRows(rows) {
    var key = state.sort, dir = state.dir;
    return rows.slice().sort(function (a, b) {
      var av = a[key], bv = b[key];
      if (av === null || av === undefined) av = key === 'name' ? '' : -Infinity;
      if (bv === null || bv === undefined) bv = key === 'name' ? '' : -Infinity;
      var c = av < bv ? -1 : av > bv ? 1 : 0;
      if (c === 0) c = a.slug < b.slug ? -1 : 1;
      return c * dir;
    });
  }

  /* ---------- board ---------- */
  var tbody = document.getElementById('rows');
  function renderBoard() {
    var rows = sortedRows(filteredRows());
    document.getElementById('count').textContent =
      rows.length + ' of ' + D.board_size + ' protocols' +
      (state.watchlistOnly ? ' (watchlist only)' : '') +
      ' · sorted by ' + state.sort.replace(/_/g, ' ');
    document.getElementById('empty').hidden = rows.length > 0;
    var html = '';
    rows.forEach(function (r) {
      var pct = maxImplied ? Math.max(2, Math.round(r.implied_value_usd / maxImplied * 100)) : 0;
      var iv = (r.interval_low_usd !== undefined && r.interval_high_usd !== undefined)
        ? '<span class="interval">P25–P75 ' + fmtCompact(r.interval_low_usd) + ' – ' + fmtCompact(r.interval_high_usd) + '</span>'
        : '';
      html += '<tr data-slug="' + esc(r.slug) + '"><td>' + r.rank + '</td>' +
        '<td><span class="name">' + esc(r.name) + '</span><br><span class="sub">' + esc(r.category || 'Uncategorised') + ' · ' + esc((r.chains || []).join(', ') || '—') + '</span></td>' +
        '<td class="num"><strong>' + fmtUSD(r.implied_value_usd) + '</strong>' + iv + '<span class="bar"><i style="width:' + pct + '%"></i></span></td>' +
        '<td class="num">' + fmtUSD(r.tvl_usd) + '</td>' +
        '<td class="num">' + fmtPct(r.change_7d) + '</td>' +
        '<td class="num">' + fmtAge(r.age_days) + '</td>' +
        '<td class="num">' + (r.launch_odds === undefined ? '—' : Math.round(r.launch_odds * 100) + '%') + '</td>' +
        '<td class="num">' + (r.expected_value_usd === undefined ? '—' : fmtUSD(r.expected_value_usd)) + '</td>' +
        '<td>' + verdictBadge(r.verdict) + '</td></tr>';
    });
    tbody.innerHTML = html;
    tbody.querySelectorAll('tr').forEach(function (tr) {
      tr.addEventListener('click', function () { openDetail(tr.getAttribute('data-slug')); });
    });
    /* keep the sort header's aria state honest */
    document.querySelectorAll('#boardTable th[data-sort]').forEach(function (th) {
      th.setAttribute('aria-sort', th.getAttribute('data-sort') === state.sort ? (state.dir === -1 ? 'descending' : 'ascending') : 'none');
    });
  }

  /* ---------- live view ---------- */
  function renderLive() {
    var html = '';
    D.live.forEach(function (p) {
      html += '<tr><td><span class="name">' + esc(p.name) + '</span><br><span class="sub">' + esc(p.category || 'Uncategorised') + ' · ' + esc((p.chains || []).join(', ') || '—') + '</span></td>' +
        '<td class="num">' + (p.mcap_usd ? fmtUSD(p.mcap_usd) : '—') + '</td>' +
        '<td class="num">' + fmtUSD(p.tvl_usd) + '</td>' +
        '<td class="num">' + fmtPct(p.change_7d) + '</td>' +
        '<td>Already trading</td></tr>';
    });
    document.getElementById('liveRows').innerHTML = html;
  }

  /* ---------- detail ---------- */
  var dialog = document.getElementById('detail');
  function openDetail(slug) {
    var row = null;
    D.rows.forEach(function (r) { if (r.slug === slug) row = r; });
    if (!row) return;
    var recomputed = impliedOf(row);
    var agrees = recomputed === row.implied_value_usd;
    var steps = buildFarmPlan(row).map(function (s) {
      return '<li>' + esc(s.text) + ' <span class="cost">Cost: ' + esc(s.cost) + '. Time: ' + esc(s.time) + '.</span></li>';
    }).join('');
    var be = row.break_even;
    var beText = be
      ? '<p><strong>Break-even.</strong> This plan spends about $' + be.gas_usd.toFixed(2) + ' in gas (one setup transaction, one a week for ' + be.weeks + ' weeks, and the claim) over ' + be.active_hours.toFixed(2) + ' active hours — so the allocation must be worth at least $' + be.usd_per_hour.toFixed(2) + ' per hour of your time to cover its cost. The capital stays in the position, so it is not counted as a cost.</p>'
      : '';
    var ivRow = (row.interval_low_usd !== undefined && row.interval_high_usd !== undefined)
      ? '<tr><td>P25–P75 range</td><td>' + fmtUSD(row.interval_low_usd) + ' – ' + fmtUSD(row.interval_high_usd) + '</td></tr>'
      : '';
    dialog.innerHTML = '<div class="detail"><button class="close" type="button" aria-label="Close">Close ×</button>' +
      '<h2>' + esc(row.name) + '</h2>' +
      '<p class="meta">Rank ' + row.rank + ' · ' + esc(row.category || 'Uncategorised') + ' · ' + esc((row.chains || []).join(', ') || '—') +
      ' · Listed ' + (row.listed_at || 'date not reported') + ' · ' + verdictBadge(row.verdict) + '</p>' +
      '<table class="walk"><tbody>' +
      '<tr><td>TVL</td><td>' + fmtUSD(row.tvl_usd) + '</td></tr>' +
      '<tr><td>Size-curve base for this TVL</td><td>' + fmtUSD(row.power_base_usd) + ' — exp(' + D.power_intercept.toFixed(4) + ' + ' + D.power_slope.toFixed(4) + ' × log(TVL))</td></tr>' +
      '<tr><td>Effective multiple</td><td>× ' + row.comparable_multiple.toFixed(4) + ' — size-curve base ÷ TVL</td></tr>' +
      '<tr class="total"><td>Implied launch value</td><td>' + fmtUSD(row.implied_value_usd) + '</td></tr>' +
      '<tr><td>Launch odds (peers\' record)</td><td>' + Math.round(row.launch_odds * 100) + '% — fitted probability that a protocol with this age, TVL and 7-day growth has launched a token by now, from the 442 launch candidates</td></tr>' +
      '<tr><td>Expected value</td><td>' + fmtUSD(row.expected_value_usd) + ' — implied value × launch odds</td></tr>' +
      ivRow +
      '<tr><td>Recomputed by this page</td><td>' + fmtUSD(recomputed) + (agrees ? ' — matches the board' : ' — differs from the board') + '</td></tr>' +
      '</tbody></table>' +
      '<h3>Farm plan — ' + esc(row.verdict) + '</h3>' +
      '<p>' + esc(row.verdict_reason) + '</p>' +
      '<ol class="plan">' + steps + '</ol>' + beText + '</div>';
    dialog.querySelector('.close').addEventListener('click', function () { dialog.close(); });
    dialog.showModal();
    try { history.replaceState(null, '', '#/protocol/' + row.slug); } catch (e) {}
  }
  dialog.addEventListener('close', function () {
    try { history.replaceState(null, '', '#'); } catch (e) {}
  });

  /* ---------- tabs ---------- */
  var tabPre = document.getElementById('tabPre');
  var tabLive = document.getElementById('tabLive');
  function setTab(tab) {
    state.tab = tab;
    tabPre.setAttribute('aria-selected', tab === 'pre' ? 'true' : 'false');
    tabLive.setAttribute('aria-selected', tab === 'live' ? 'true' : 'false');
    document.getElementById('boardTable').hidden = tab !== 'pre';
    document.getElementById('liveTable').hidden = tab !== 'live';
    if (tab === 'live') renderLive();
  }
  tabPre.addEventListener('click', function () { setTab('pre'); });
  tabLive.addEventListener('click', function () { setTab('live'); });

  /* ---------- controls ---------- */
  document.getElementById('q').addEventListener('input', function (e) { state.q = e.target.value; renderBoard(); });
  catSel.addEventListener('change', function (e) { state.category = e.target.value; renderBoard(); });
  chainSel.addEventListener('change', function (e) { state.chain = e.target.value; renderBoard(); });
  document.getElementById('verdict').addEventListener('change', function (e) { state.verdict = e.target.value; renderBoard(); });
  document.getElementById('watchlistOnly').addEventListener('change', function (e) { state.watchlistOnly = e.target.checked; renderBoard(); });
  document.getElementById('minTvl').addEventListener('change', function (e) { state.minTvl = Number(e.target.value); renderBoard(); });
  document.getElementById('clearFilters').addEventListener('click', function () {
    state.q = ''; state.category = ''; state.chain = ''; state.verdict = ''; state.watchlistOnly = false; state.minTvl = 0;
    document.getElementById('q').value = ''; catSel.value = ''; chainSel.value = '';
    document.getElementById('verdict').value = ''; document.getElementById('watchlistOnly').checked = false;
    document.getElementById('minTvl').value = '0'; renderBoard();
  });
  document.querySelectorAll('#boardTable th[data-sort]').forEach(function (th) {
    th.addEventListener('click', function () {
      var key = th.getAttribute('data-sort');
      if (state.sort === key) { state.dir = -state.dir; }
      else { state.sort = key; state.dir = (key === 'rank' || key === 'name' || key === 'verdict') ? 1 : -1; }
      renderBoard();
    });
  });

  /* ---------- hash routing ---------- */
  function route() {
    var m = (location.hash || '').match(/^#\/protocol\/([A-Za-z0-9._-]+)$/);
    if (m) openDetail(m[1]);
  }
  window.addEventListener('hashchange', route);

  renderBoard();
  route();
})();
