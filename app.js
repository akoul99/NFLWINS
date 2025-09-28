// Lightweight mobile app to track NFLWins league

// Team normalization: map loose names/typos/abbreviations to ESPN canonical abbreviations
const TEAM_SYNONYMS = new Map(Object.entries({
  // NFC East
  washington: 'WSH', commanders: 'WSH', was: 'WSH', wsh: 'WSH',
  cowboys: 'DAL', dal: 'DAL', dallas: 'DAL',
  eagles: 'PHI', phi: 'PHI', philadelphia: 'PHI',
  giants: 'NYG', nyg: 'NYG', 'newyorkgiants': 'NYG',
  // NFC North
  packers: 'GB', gb: 'GB', greenbay: 'GB',
  bears: 'CHI', chi: 'CHI', beras: 'CHI', chicago: 'CHI',
  vikings: 'MIN', min: 'MIN', minnesota: 'MIN',
  lions: 'DET', det: 'DET', detroit: 'DET',
  // NFC South
  buccaneers: 'TB', bucs: 'TB', buc: 'TB', tb: 'TB', tampa: 'TB', tampabay: 'TB',
  saints: 'NO', no: 'NO', nol: 'NO', neworleans: 'NO',
  falcons: 'ATL', atl: 'ATL', atlanta: 'ATL',
  panthers: 'CAR', car: 'CAR', carolina: 'CAR',
  // NFC West
  '49ers': 'SF', niners: 'SF', sf: 'SF', sanfrancisco: 'SF',
  rams: 'LAR', lar: 'LAR', la: 'LAR',
  seahawks: 'SEA', sea: 'SEA', seattle: 'SEA',
  cardinals: 'ARI', arizona: 'ARI', ari: 'ARI', cardinasl: 'ARI',
  // AFC East
  bills: 'BUF', buf: 'BUF', buffalo: 'BUF',
  patriots: 'NE', ne: 'NE', newengland: 'NE',
  dolphins: 'MIA', mia: 'MIA', miami: 'MIA',
  jets: 'NYJ', nyj: 'NYJ', 'newyorkjets': 'NYJ',
  // AFC North
  ravens: 'BAL', bal: 'BAL', baltimore: 'BAL',
  bengals: 'CIN', cin: 'CIN', cincinnati: 'CIN',
  browns: 'CLE', cle: 'CLE', cleveland: 'CLE',
  steelers: 'PIT', steelesr: 'PIT', pit: 'PIT', pittsburgh: 'PIT',
  // AFC South
  colts: 'IND', ind: 'IND', indy: 'IND',
  texans: 'HOU', hou: 'HOU', houston: 'HOU',
  jaguars: 'JAX', jags: 'JAX', jax: 'JAX', jac: 'JAX', jacksonville: 'JAX',
  titans: 'TEN', ten: 'TEN', tennessee: 'TEN',
  // AFC West
  chiefs: 'KC', cheifs: 'KC', kc: 'KC', kansascity: 'KC',
  broncos: 'DEN', den: 'DEN', denver: 'DEN',
  chargers: 'LAC', lac: 'LAC', sd: 'LAC', sandiego: 'LAC',
  raiders: 'LV', lv: 'LV', vegas: 'LV', oak: 'LV', oakland: 'LV'
}));

const ALIAS_BY_CANON = new Map(Object.entries({
  WSH: ['WAS', 'WSH'],
  LAC: ['LAC', 'SD'],
  LAR: ['LAR', 'LA'],
  LV: ['LV', 'OAK'],
  JAX: ['JAX', 'JAC']
}));

function normalizeKey(s) {
  return String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

function normalizeTeam(token) {
  const key = normalizeKey(token);
  if (!key) return null;
  // direct map by synonyms or abbr
  if (TEAM_SYNONYMS.has(key)) return TEAM_SYNONYMS.get(key);
  // try upper-case 2-3 letter abbr direct guess
  if (/^[a-z0-9]{2,4}$/i.test(token)) {
    const upper = String(token).toUpperCase();
    // find which canonical contains this as alias
    for (const [canon, variants] of ALIAS_BY_CANON.entries()) {
      if (variants.includes(upper)) return canon;
    }
    // fallback: assume already canonical
    return upper;
  }
  return null;
}

function parseTeamsList(input) {
  const items = String(input || '')
    .split(',')
    .flatMap(part => part.trim().length ? part.trim().split(/\s+/) : [])
    .filter(Boolean);
  const out = [];
  for (const it of items) {
    const t = normalizeTeam(it);
    if (t && !out.includes(t)) out.push(t);
    if (out.length === 4) break;
  }
  return out;
}

function getSeasonYear() {
  const now = new Date();
  const month = now.getMonth() + 1; // 1-12
  return month >= 9 ? now.getFullYear() : now.getFullYear() - 1;
}

const DEFAULT_LEAGUE = {
  players: [
    { id: 'p1', name: 'Ashwin', teams: parseTeamsList('commanders, packers, texans, saints') },
    { id: 'p2', name: 'sartih', teams: parseTeamsList('buc, broncos, patriots, jets') },
    { id: 'p3', name: 'neil', teams: parseTeamsList('falcons, beras, cowboys, dolphins') },
    { id: 'p4', name: 'adrian', teams: parseTeamsList('steelesr, cheifs, cardinasl, colts') },
    { id: 'p5', name: 'faisal', teams: parseTeamsList('bills, eagles, titans, giants') },
    { id: 'p6', name: 'pranav', teams: parseTeamsList('49ers bengals, chargers, browns') },
    { id: 'p7', name: 'neloy', teams: parseTeamsList('vikings, rams, lions, panthers') },
    { id: 'p8', name: 'irfan', teams: parseTeamsList('seahawks, ravens, jaguars, raiders') }
  ],
  startYear: getSeasonYear()
};

const STATE = {
  league: /** @type {{ players: Array<{id:string,name:string,teams:string[]}>; startYear:number }} */ (
    JSON.parse(localStorage.getItem('nflwins.league') || 'null') || DEFAULT_LEAGUE
  ),
  weeks: [], // populated from API
  standings: []
};

// Load design.json and map tokens to CSS variables
await (async function applyDesign() {
  try {
    const res = await fetch('design.json');
    if (!res.ok) return;
    const design = await res.json();
    const root = document.documentElement.style;
    const toVar = (key) => `--pfm-${key}`;
    const colors = design.tokens?.colors || {};
    for (const [k, v] of Object.entries(colors)) {
      if (typeof v === 'string') root.setProperty(toVar(k), v);
    }
    // basic typography
    const family = design.tokens?.typography?.fontFamilies?.ui || 'Inter, system-ui';
    root.setProperty('--pfm-font-ui', family);
  } catch (e) {
    console.warn('Failed to apply design.json', e);
  }
})();

// Lightweight cache in localStorage with TTL to speed up repeated fetches
const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes
function cacheKey(year, week) { return `nflwins.cache.scoreboard:${year}:${week}`; }
function cacheGet(year, week) {
  try {
    const raw = localStorage.getItem(cacheKey(year, week));
    if (!raw) return null;
    const obj = JSON.parse(raw);
    if (!obj || !obj.t || !obj.v) return null;
    if (Date.now() - obj.t > CACHE_TTL_MS) return null;
    return obj.v;
  } catch { return null; }
}
function cacheSet(year, week, value) {
  try { localStorage.setItem(cacheKey(year, week), JSON.stringify({ t: Date.now(), v: value })); } catch {}
}

// Run async mapper with concurrency limit
async function mapWithConcurrency(items, limit, mapper) {
  const results = new Array(items.length);
  let index = 0;
  const workers = new Array(Math.min(limit, items.length)).fill(0).map(async () => {
    while (true) {
      const i = index++;
      if (i >= items.length) return;
      try { results[i] = await mapper(items[i], i); } catch { results[i] = undefined; }
    }
  });
  await Promise.all(workers);
  return results;
}

// Routing
const routes = {
  standings: renderStandings,
  trends: renderTrends
};

document.querySelectorAll('.bottom-bar .tab').forEach(btn => {
  btn.addEventListener('click', () => {
    const view = btn.getAttribute('data-view');
    document.querySelectorAll('.bottom-bar .tab').forEach(t => t.classList.toggle('active', t === btn));
    navigate(view);
  });
});

document.getElementById('btnSettings').addEventListener('click', openLeagueDialog);

navigate('standings');
autoRefresh();

// Data fetch: ESPN Scoreboard API (public JSON)
// We'll use week-based endpoints, compute total wins per team.
async function fetchWeekGames(year, week) {
  // cache first
  const cached = cacheGet(year, week);
  if (Array.isArray(cached) && cached.length > 0) return cached;
  const proxyBase = `${location.origin}/api`;
  const isLocal = /^(localhost|127\.0\.0\.1)$/.test(location.hostname);
  const urls = isLocal ? [
    // local dev: prefer local proxy first, then same-origin (likely 404)
    `http://localhost:5174/scoreboard?week=${week}&year=${year}`,
    `${proxyBase}/scoreboard?week=${week}&year=${year}`,
    `https://site.api.espn.com/apis/v2/sports/football/nfl/scoreboard?week=${week}&seasontype=2&year=${year}`,
    `https://site.api.espn.com/apis/v2/sports/football/nfl/scoreboard?week=${week}&dates=${year}09`
  ] : [
    // production: only same-origin function to avoid CORS/404 noise
    `${proxyBase}/scoreboard?week=${week}&year=${year}`
  ];
  let json = null; let lastErr = null;
  for (const url of urls) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 8000);
      const res = await fetch(url, { cache: 'no-store', signal: controller.signal });
      clearTimeout(timeout);
      if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
      json = await res.json();
      // If proxy returns array already normalized, forward it
      if (Array.isArray(json)) {
        if (json.length > 0) cacheSet(year, week, json);
        return json;
      }
      break;
    } catch (e) {
      lastErr = e;
      continue;
    }
  }
  if (!json) {
    console.warn('Scoreboard fetch failed', { year, week, error: lastErr });
    return [];
  }
  const events = json.events || [];
  if (Array.isArray(events) && events.length) {
    const normalized = events.map(ev => {
    const comp = ev.competitions?.[0];
    const home = comp?.competitors?.find(c => c.homeAway === 'home');
    const away = comp?.competitors?.find(c => c.homeAway === 'away');
    const status = comp?.status?.type?.state; // pre, in, post
    const winnerId = comp?.competitors?.find(c => c.winner)?.team?.abbreviation;
    return {
      id: ev.id,
      status,
      home: home?.team?.abbreviation,
      away: away?.team?.abbreviation,
      winner: winnerId || null
    };
    });
    if (normalized.length > 0) cacheSet(year, week, normalized);
    return normalized;
  }
  // Fallback empty
  return [];
}

async function computeStandings(upToWeek) {
  const year = STATE.league.startYear;
  const players = STATE.league.players;
  const teamToPlayer = new Map();
  players.forEach(p => p.teams.forEach(t => teamToPlayer.set((t||'').toUpperCase(), p.id)));

  const winsByPlayer = new Map(players.map(p => [p.id, 0]));
  const winsByTeam = new Map(); // team -> wins
  const weeklySeries = new Map(players.map(p => [p.id, []]));

  const weeks = Array.from({ length: upToWeek }, (_, i) => i + 1);
  const gamesByWeek = await mapWithConcurrency(
    weeks,
    6,
    (w) => fetchWeekGames(year, w).catch(() => [])
  );

  for (let idx = 0; idx < gamesByWeek.length; idx++) {
    const games = gamesByWeek[idx] || [];
    for (const g of games) {
      if (!g) continue;
      let winTeam = g.winner;
      if (!winTeam && Number.isFinite(g.homeScore) && Number.isFinite(g.awayScore) && g.homeScore !== g.awayScore) {
        winTeam = g.homeScore > g.awayScore ? g.home : g.away;
      }
      if (winTeam) {
        const pid = teamToPlayer.get(String(winTeam).toUpperCase());
        if (pid) winsByPlayer.set(pid, winsByPlayer.get(pid) + 1);
        const key = String(winTeam).toUpperCase();
        winsByTeam.set(key, (winsByTeam.get(key) || 0) + 1);
      }
    }
    for (const p of players) weeklySeries.get(p.id).push(winsByPlayer.get(p.id));
  }

  const standings = players.map(p => ({
    id: p.id,
    name: p.name,
    wins: winsByPlayer.get(p.id),
    series: weeklySeries.get(p.id),
    teams: p.teams.map(t => ({ code: t, wins: winsByTeam.get(String(t).toUpperCase()) || 0 }))
  })).sort((a,b) => b.wins - a.wins);

  STATE.standings = standings;
  return standings;
}

function navigate(view) {
  const fn = routes[view] || routes.standings;
  fn();
}

function renderStandings() {
  mountTemplate('tmpl-standings');
  document.getElementById('btnRefresh').addEventListener('click', refreshAll);
  refreshAll();
}

// removed Teams view

async function renderTrends() {
  mountTemplate('tmpl-trends');
  await refreshAll();
  await drawChart();
}

async function drawChart() {
  const svg = document.getElementById('trendChart');
  const maxWeek = await detectCurrentWeek();
  const standings = await computeStandings(maxWeek);
  const width = 360, height = 200, padding = 24;
  svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
  svg.innerHTML = '';
  // axes
  const axis = document.createElementNS('http://www.w3.org/2000/svg','path');
  axis.setAttribute('d', `M ${padding} ${height-padding} H ${width-padding} M ${padding} ${height-padding} V ${padding}`);
  axis.setAttribute('stroke', 'var(--pfm-border,#E6E1F5)');
  axis.setAttribute('fill', 'none');
  svg.appendChild(axis);

  // axis labels
  const xLabel = document.createElementNS('http://www.w3.org/2000/svg','text');
  xLabel.setAttribute('x', String(width - padding));
  xLabel.setAttribute('y', String(height - 4));
  xLabel.setAttribute('text-anchor', 'end');
  xLabel.setAttribute('fill', 'var(--pfm-muted,#9CA3AF)');
  xLabel.setAttribute('font-size', '10');
  xLabel.textContent = 'Weeks';
  svg.appendChild(xLabel);

  const yLabel = document.createElementNS('http://www.w3.org/2000/svg','text');
  yLabel.setAttribute('x', String(padding));
  yLabel.setAttribute('y', String(padding - 6));
  yLabel.setAttribute('text-anchor', 'start');
  yLabel.setAttribute('fill', 'var(--pfm-muted,#9CA3AF)');
  yLabel.setAttribute('font-size', '10');
  yLabel.textContent = 'Wins';
  svg.appendChild(yLabel);

  // x tick marks
  const ticks = Math.min(10, maxWeek);
  for (let i = 0; i <= ticks; i++) {
    const w = Math.round((i / ticks) * (maxWeek - 1)) + 1;
    const x = padding + ((w-1)/(maxWeek-1 || 1)) * (width - padding*2);
    const t = document.createElementNS('http://www.w3.org/2000/svg','text');
    t.setAttribute('x', String(x));
    t.setAttribute('y', String(height - padding + 14));
    t.setAttribute('text-anchor', 'middle');
    t.setAttribute('fill', 'var(--pfm-muted,#9CA3AF)');
    t.setAttribute('font-size', '9');
    t.textContent = String(w);
    svg.appendChild(t);
  }

  const maxWins = Math.max(1, ...standings.map(s => s.series[maxWeek-1] || 0));
  const colorScale = [
    'var(--pfm-primary,#22C55E)', '#06B6D4', '#60A5FA', '#F59E0B', '#EF4444', '#A78BFA', '#34D399', '#F472B6'
  ];

  standings.forEach((s, i) => {
    const series = s.series.slice(0, maxWeek);
    const path = series.map((v, idx) => {
      const x = padding + (idx/(maxWeek-1 || 1)) * (width - padding*2);
      const y = height - padding - (v/maxWins) * (height - padding*2);
      return `${idx===0?'M':'L'} ${x.toFixed(1)} ${y.toFixed(1)}`;
    }).join(' ');
    const p = document.createElementNS('http://www.w3.org/2000/svg','path');
    p.setAttribute('d', path);
    p.setAttribute('stroke', colorScale[i%colorScale.length]);
    p.setAttribute('fill', 'none');
    p.setAttribute('stroke-width', '2');
    svg.appendChild(p);
  });

  // legend
  const legend = document.getElementById('trendLegend');
  legend.innerHTML = '';
  standings.forEach((s, i) => {
    const item = document.createElement('div');
    item.className = 'legend-item';
    const sw = document.createElement('span');
    sw.className = 'legend-swatch';
    sw.style.background = colorScale[i%colorScale.length];
    const label = document.createElement('span');
    label.textContent = s.name;
    item.appendChild(sw); item.appendChild(label);
    legend.appendChild(item);
  });
}

async function detectCurrentWeek() {
  const year = STATE.league.startYear;
  const approx = approximateCurrentWeek(year);
  // Probe around the approximate week only (fast)
  const candidates = [];
  for (let d = 0; d <= 3; d++) {
    const w1 = Math.max(1, approx - d);
    const w2 = Math.min(22, approx + d);
    if (!candidates.includes(w1)) candidates.push(w1);
    if (!candidates.includes(w2)) candidates.push(w2);
  }
  for (const w of candidates) {
    const games = await fetchWeekGames(year, w);
    if (Array.isArray(games) && games.length > 0) return w;
  }
  // Fallback slow path once
  const weeks = Array.from({ length: 22 }, (_, i) => i + 1);
  const results = await mapWithConcurrency(weeks, 6, (w) => fetchWeekGames(year, w).catch(() => []));
  for (let i = results.length - 1; i >= 0; i--) {
    if (Array.isArray(results[i]) && results[i].length > 0) return i + 1;
  }
  return approx;
}

function approximateCurrentWeek(year) {
  // Start at first Thursday of September (approx NFL kickoff)
  let d = new Date(year, 8, 1); // Sep 1
  while (d.getDay() !== 4) d.setDate(d.getDate() + 1); // 4=Thu
  const now = new Date();
  const ms = Math.max(0, now - d);
  const week = Math.floor(ms / (7 * 24 * 3600 * 1000)) + 1;
  return Math.min(22, Math.max(1, week));
}

async function refreshAll() {
  try {
    showToast('Updating...');
    const week = await detectCurrentWeek();
    await computeStandings(week);
    renderStandingsList();
    hideToast(600);
  } catch (e) {
    console.error(e);
    showToast('Update failed');
  }
}

function renderStandingsList() {
  const list = document.getElementById('standingsList');
  if (!list) return;
  list.innerHTML = '';
  STATE.standings.forEach((s, idx) => {
    const wrapper = document.createElement('div');
    const row = document.createElement('div');
    row.className = 'row';
    row.innerHTML = `
      <div class="title">${idx+1}. ${escapeHtml(s.name)}</div>
      <div class="title" style="display:flex;align-items:center;gap:8px;">
        <span>${s.wins}</span>
        <span class="chevron">▶</span>
      </div>
    `;
    wrapper.appendChild(row);
    const expand = document.createElement('div');
    expand.className = 'expand';
    expand.style.display = 'none';
    s.teams.forEach(team => {
      const trow = document.createElement('div');
      trow.className = 'team-row';
      const live = findLiveGameForTeam(team.code);
      const right = live ? `${live.home === team.code ? live.homeScore : live.awayScore} - ${live.home === team.code ? live.awayScore : live.homeScore} ${formatLiveClock(live)}` : `${team.wins} wins`;
      trow.innerHTML = `
        <div class="subtitle">${escapeHtml(team.code)}</div>
        <div class="subtitle">${right}</div>
      `;
      expand.appendChild(trow);
    });
    wrapper.appendChild(expand);
    row.addEventListener('click', () => {
      const open = expand.style.display !== 'none';
      expand.style.display = open ? 'none' : 'grid';
      row.classList.toggle('open', !open);
    });
    list.appendChild(wrapper);
  });
}

function openLeagueDialog() {
  const dlg = document.getElementById('dlgLeague');
  const body = document.getElementById('dlgLeagueBody');
  body.innerHTML = '';
  STATE.league.players.forEach((p, idx) => {
    const wrap = document.createElement('div');
    wrap.className = 'card';
    wrap.style.padding = '12px';
    wrap.innerHTML = `
      <div class="field">
        <label>Player ${idx+1} Name
          <input type="text" value="${escapeAttr(p.name)}" data-player="${p.id}" data-type="name" />
        </label>
      </div>
      <div class="field">
        <label>Teams (comma separated abbreviations, e.g., KC, BUF)
          <input type="text" value="${escapeAttr(p.teams.join(', '))}" data-player="${p.id}" data-type="teams" />
        </label>
      </div>
    `;
    body.appendChild(wrap);
  });
  const form = dlg.querySelector('form');
  form.addEventListener('submit', saveLeagueFromDialog, { once: true });
  dlg.showModal();
}

function saveLeagueFromDialog(ev) {
  ev.preventDefault();
  const dlg = document.getElementById('dlgLeague');
  const inputs = dlg.querySelectorAll('input[data-player]');
  const map = new Map(STATE.league.players.map(p => [p.id, { ...p }]));
  inputs.forEach(inp => {
    const id = inp.getAttribute('data-player');
    const type = inp.getAttribute('data-type');
    const p = map.get(id);
    if (type === 'name') p.name = inp.value.trim() || p.name;
    if (type === 'teams') p.teams = parseTeamsList(inp.value);
  });
  STATE.league.players = Array.from(map.values());
  localStorage.setItem('nflwins.league', JSON.stringify(STATE.league));
  dlg.close();
  navigate('teams');
}

function autoRefresh() {
  setInterval(() => {
    // silent background refresh on standings view
    const active = document.querySelector('.bottom-bar .tab.active')?.getAttribute('data-view');
    if (active === 'standings') refreshAll();
  }, 5 * 60 * 1000); // every 5 minutes
}

// utils
function mountTemplate(id) {
  const tpl = document.getElementById(id);
  const root = document.getElementById('app');
  root.innerHTML = '';
  root.appendChild(tpl.content.cloneNode(true));
}
function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg; t.classList.add('show');
}
function hideToast(delay=0) {
  setTimeout(() => document.getElementById('toast').classList.remove('show'), delay);
}
function escapeHtml(s) {
  return String(s).replace(/[&<>]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;'}[c]));
}
function escapeAttr(s) {
  return String(s).replace(/"/g, '&quot;');
}

// Live helpers
function getLatestWeekGames() {
  const year = STATE.league.startYear;
  const week = approximateCurrentWeek(year);
  return fetchWeekGames(year, week);
}
let LIVE_CACHE = { stamp: 0, games: [] };
function findLiveGameForTeam(teamCode) {
  const maxAge = 60 * 1000; // 1 minute
  if (Date.now() - LIVE_CACHE.stamp > maxAge) return null;
  const code = String(teamCode).toUpperCase();
  return LIVE_CACHE.games.find(g => (g.home === code || g.away === code) && (!g.winner) && (g.homeScore !== undefined));
}
function formatLiveClock(g) {
  if (!g || !g.quarter) return '(live)';
  return `(Q${g.quarter} ${g.clock || ''})`;
}

// background live refresh
setInterval(async () => {
  try {
    const games = await getLatestWeekGames();
    LIVE_CACHE = { stamp: Date.now(), games };
  } catch {}
}, 60 * 1000);


