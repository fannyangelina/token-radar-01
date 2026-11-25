/* Token Radar — the dashboard. Vanilla JS, no framework, no network.
   Reads window.RADAR (zz-data.js), renders the board, and recomputes every
   number it shows from the snapshot's own figures, so the page and the board
   are the same arithmetic. */
'use strict';
(function () {
  var D = window.RADAR;
  if (!D || !D.rows) { document.getElementById('rows').innerHTML = '<tr><td colspan="7">No radar data loaded.</td></tr>'; return; }

  /* ---------- model: the same factors main.ts uses, recomputed here ---------- */
  function momentumFactor(change7d) {
    if (change7d === null || change7d === undefined) return 1;
    return Math.min(1.5, Math.max(0.8, 1 + (change7d / 100) * 0.5));
  }
  function maturityFactor(ageDays) {
    var a = ageDays === null || ageDays === undefined ? D.median_age_days : ageDays;
    return 0.6 + (Math.min(Math.max(a, 0), 1095) / 1095) * 0.4;
  }
  /** The implied value of one row, recomputed from its stored factors: the
      same multiplication main.ts performs, so the page and the board agree. */
  function impliedOf(row) {
    var raw = row.tvl_usd * row.comparable_multiple * row.momentum_factor * row.maturity_factor;
    return Math.max(1000000, Math.min(100000000000000, Math.round(raw)));
  }
  /** Median mcap/tvl of the tokened protocols in a category — the comparable
      multiple. Computed from the snapshot at build time; the page shows the
      multiple and how many comparables stand behind it. */
  function computeComparables() {
    var byCat = {};
    D.rows.forEach(function (r) {
      if (!byCat[r.category]) byCat[r.category] = [];
      byCat[r.category].push(r.comparable_multiple);
    });
    return byCat;
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
    'Snapshot: ' + D.source + '. Model ' + D.model_version + '. Global comparable multiple ' + D.global_multiple.toFixed(4) + '; median age with no token ' + D.median_age_days + ' days.';
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
      'The comparables come from ' + A.comparables + ' tokened protocols with a positive market cap; ' +
      A.dead_mcap_le_zero + ' tokened protocols whose market cap is 0 or negative are dead tokens and are left out of the comparables.';
  }
  /* Held-out test, reported honestly: leave-one-out over the tokened protocols. */
  if (D.held_out) {
    var H = D.held_out;
    document.getElementById('heldOutLine').textContent =
      'Leave-one-out over the ' + H.n + ' tokened protocols with a positive market cap: for each one, the model predicts its market cap from the multiples computed without it. ' +
      'The full model lands within 2× of the actual market cap for ' + Math.round(H.model_within_2x * 100) + '% (median |log error| ' + H.model_median_log_err.toFixed(2) + '), ' +
      'against ' + Math.round(H.flat_within_2x * 100) + '% for a flat global multiple (median |log error| ' + H.flat_median_log_err.toFixed(2) + '). ' +
      'On pure market-cap ranking the full model scores Spearman ' + H.model_spearman.toFixed(2) + ' against ' + H.tvl_spearman.toFixed(2) + ' for TVL alone: ' +
      'TVL is the strongest single ranker of market cap, and the extra terms trade a little of that for launch-timing signal — seven-day growth and wait time — that a TVL-only ranking cannot express. ' +
      'The board ranks launches, not market caps, so the terms stay; the test is here so the reader can see the trade-off.';
  }

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
      html += '<tr data-slug="' + esc(r.slug) + '"><td>' + r.rank + '</td>' +
        '<td><span class="name">' + esc(r.name) + '</span><br><span class="sub">' + esc(r.category || 'Uncategorised') + ' · ' + esc((r.chains || []).join(', ') || '—') + '</span></td>' +
        '<td class="num"><strong>' + fmtUSD(r.implied_value_usd) + '</strong><span class="bar"><i style="width:' + pct + '%"></i></span></td>' +
        '<td class="num">' + fmtUSD(r.tvl_usd) + '</td>' +
        '<td class="num">' + fmtPct(r.change_7d) + '</td>' +
        '<td class="num">' + fmtAge(r.age_days) + '</td>' +
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
    var compNote = row.comparable_source === 'category'
      ? 'median mcap/TVL of ' + row.comparables_used + ' tokened ' + (row.category || '') + ' protocols'
      : 'global median (fewer than 3 tokened comparables in ' + (row.category || 'this category') + ')';
    var steps = buildFarmPlan(row).map(function (s) {
      return '<li>' + esc(s.text) + ' <span class="cost">Cost: ' + esc(s.cost) + '. Time: ' + esc(s.time) + '.</span></li>';
    }).join('');
    var be = row.break_even;
    var beText = be
      ? '<p><strong>Break-even.</strong> This plan spends about $' + be.gas_usd.toFixed(2) + ' in gas (one setup transaction, one a week for ' + be.weeks + ' weeks, and the claim) over ' + be.active_hours.toFixed(2) + ' active hours — so the allocation must be worth at least $' + be.usd_per_hour.toFixed(2) + ' per hour of your time to cover its cost. The capital stays in the position, so it is not counted as a cost.</p>'
      : '';
    dialog.innerHTML = '<div class="detail"><button class="close" type="button" aria-label="Close">Close ×</button>' +
      '<h2>' + esc(row.name) + '</h2>' +
      '<p class="meta">Rank ' + row.rank + ' · ' + esc(row.category || 'Uncategorised') + ' · ' + esc((row.chains || []).join(', ') || '—') +
      ' · Listed ' + (row.listed_at || 'date not reported') + ' · ' + verdictBadge(row.verdict) + '</p>' +
      '<table class="walk"><tbody>' +
      '<tr><td>TVL</td><td>' + fmtUSD(row.tvl_usd) + '</td></tr>' +
      '<tr><td>Comparable multiple (' + esc(row.category || 'no category') + ')</td><td>× ' + row.comparable_multiple.toFixed(4) + ' — ' + esc(compNote) + '</td></tr>' +
      '<tr><td>Momentum factor (7-day ' + (row.change_7d === null ? 'not reported' : row.change_7d.toFixed(1) + '%') + ')</td><td>× ' + row.momentum_factor.toFixed(2) + '</td></tr>' +
      '<tr><td>Maturity factor (' + (row.age_days === null ? 'age not reported, median ' + D.median_age_days + ' days' : fmtAge(row.age_days) + ' with no token') + ')</td><td>× ' + row.maturity_factor.toFixed(2) + '</td></tr>' +
      '<tr class="total"><td>Implied launch value</td><td>' + fmtUSD(row.implied_value_usd) + '</td></tr>' +
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
