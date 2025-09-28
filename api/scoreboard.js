// Vercel Serverless Function: Normalizes NFL games for a given week/year
// Usage: /api/scoreboard?week=1&year=2025

module.exports = async function handler(req, res) {
  try {
    const { week, year } = req.query || {};
    if (!week || !year) {
      res.status(400).json({ error: 'week and year required' });
      return;
    }

    const games = await fetchGames(String(year), String(week));
    res.setHeader('Cache-Control', 'public, s-maxage=60');
    res.status(200).json(games);
  } catch (e) {
    res.status(502).json({ error: String(e) });
  }
}

async function fetchGames(year, week) {
  const rapid = await tryRapidApi(year, week);
  if (rapid && rapid.length) return rapid;
  const espn = await tryEspn(year, week);
  return espn || [];
}

async function tryRapidApi(year, week) {
  const key = process.env.RAPIDAPI_KEY;
  if (!key) return null;
  const host = 'tank01-nfl-live-in-game-real-time-statistics-nfl.p.rapidapi.com';
  const url = `https://${host}/getNFLGamesForWeek?season=${year}&week=${week}&seasonType=reg`;
  try {
    const r = await fetch(url, {
      headers: {
        'X-RapidAPI-Key': key,
        'X-RapidAPI-Host': host,
        'Accept': 'application/json'
      },
      cache: 'no-store'
    });
    if (!r.ok) throw new Error(String(r.status));
    const data = await r.json();
    const body = Array.isArray(data) ? data : (data?.body || data?.games || []);
    if (!Array.isArray(body)) return null;
    return body.map(g => normalize(
      g.homeTeam || g.home || g.homeTeamAbbr,
      g.awayTeam || g.away || g.awayTeamAbbr,
      g.homeScoreTotal ?? g.homeScore ?? 0,
      g.awayScoreTotal ?? g.awayScore ?? 0,
      (g.gameStatus || g.status || '').toLowerCase(),
      g.quarter || g.qtr,
      g.gameClock || g.clock,
      g.gameID || g.gameId || g.id
    )).filter(Boolean);
  } catch {
    return null;
  }
}

async function tryEspn(year, week) {
  const urls = [
    `https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard?week=${week}&seasontype=2&year=${year}`,
    `https://site.api.espn.com/apis/v2/sports/football/nfl/scoreboard?week=${week}&seasontype=2&year=${year}`
  ];
  for (const url of urls) {
    try {
      const r = await fetch(url, { cache: 'no-store' });
      if (!r.ok) continue;
      const data = await r.json();
      const events = data?.events || [];
      if (!Array.isArray(events)) continue;
      return events.map(ev => {
        const comp = ev?.competitions?.[0];
        const home = comp?.competitors?.find(c => c.homeAway === 'home');
        const away = comp?.competitors?.find(c => c.homeAway === 'away');
        const status = comp?.status?.type?.state;
        const winner = comp?.competitors?.find(c => c.winner)?.team?.abbreviation;
        return normalize(
          home?.team?.abbreviation,
          away?.team?.abbreviation,
          Number(home?.score || 0),
          Number(away?.score || 0),
          status,
          comp?.status?.period,
          comp?.status?.displayClock,
          ev?.id
        );
      }).filter(Boolean);
    } catch {
      continue;
    }
  }
  return null;
}

function normalize(home, away, hs, as, status, quarter, clock, id) {
  if (!home || !away) return null;
  let winner = null;
  if (String(status).toLowerCase().startsWith('final') && hs !== as) {
    winner = hs > as ? home : away;
  }
  return {
    home: String(home).toUpperCase(),
    away: String(away).toUpperCase(),
    winner: winner ? String(winner).toUpperCase() : null,
    status: status || 'unknown',
    homeScore: Number(hs || 0),
    awayScore: Number(as || 0),
    quarter: quarter || null,
    clock: clock || null,
    id: id || null
  };
}


