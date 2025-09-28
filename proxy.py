#!/usr/bin/env python3

from http.server import BaseHTTPRequestHandler, HTTPServer
from urllib.parse import urlparse, parse_qs
from urllib.request import Request, urlopen
from datetime import datetime, timedelta
import json
import os
import ssl

PORT = int(os.environ.get('PORT', '5174'))

def iter_ssl_contexts():
    contexts = []
    try:
        import certifi  # type: ignore
        contexts.append(ssl.create_default_context(cafile=certifi.where()))
    except Exception:
        pass
    try:
        contexts.append(ssl.create_default_context())
    except Exception:
        pass
    try:
        contexts.append(ssl._create_unverified_context())
    except Exception:
        pass
    return contexts

def get_ssl_context():
    try:
        import certifi  # type: ignore
        ctx = ssl.create_default_context(cafile=certifi.where())
        return ctx
    except Exception:
        try:
            return ssl.create_default_context()
        except Exception:
            # Last resort: disable verification (dev only)
            return ssl._create_unverified_context()


def fetch_scoreboard(year: str, week: str):
    # Prefer RapidAPI if key is present
    rapid_key = os.environ.get('RAPIDAPI_KEY')
    if rapid_key:
        try:
            host = 'tank01-nfl-live-in-game-real-time-statistics-nfl.p.rapidapi.com'
            url = f"https://{host}/getNFLGamesForWeek?season={year}&week={week}&seasonType=reg"
            headers = {
                'X-RapidAPI-Key': rapid_key,
                'X-RapidAPI-Host': host,
                'User-Agent': 'Mozilla/5.0',
                'Accept': 'application/json'
            }
            raw = None
            last_err = None
            for ctx in iter_ssl_contexts():
                try:
                    req = Request(url, headers=headers)
                    with urlopen(req, timeout=12, context=ctx) as resp:
                        raw = resp.read()
                        break
                except Exception as e:
                    last_err = e
                    continue
            if raw is None:
                raise last_err or RuntimeError('RapidAPI HTTPS failed')
                try:
                    data = json.loads(raw)
                except Exception:
                    data = None
                # Normalize to array of {home, away, winner, status, homeScore, awayScore, quarter, clock, id}
                games = []
                if isinstance(data, dict):
                    # tank01 often returns {body: [ { homeTeam, awayTeam, gameStatus, homeScore, awayScore, ... } ]}
                    body = data.get('body') or data.get('games') or []
                    if isinstance(body, list):
                        for g in body:
                            home = g.get('homeTeam') or g.get('home') or g.get('homeTeamAbbr')
                            away = g.get('awayTeam') or g.get('away') or g.get('awayTeamAbbr')
                            hs = g.get('homeScoreTotal') or g.get('homeScore') or 0
                            as_ = g.get('awayScoreTotal') or g.get('awayScore') or 0
                            status = (g.get('gameStatus') or g.get('status') or '').lower()
                            qtr = g.get('quarter') or g.get('qtr')
                            clock = g.get('gameClock') or g.get('clock')
                            gid = g.get('gameID') or g.get('gameId') or g.get('id')
                            winner = None
                            try:
                                if str(status).startswith('final') or str(status).startswith('completed'):
                                    winner = (home if int(hs) > int(as_) else away) if (hs != as_) else None
                            except Exception:
                                winner = None
                            if home and away:
                                games.append({
                                    'home': str(home).upper(),
                                    'away': str(away).upper(),
                                    'winner': (str(winner).upper() if winner else None),
                                    'status': status or 'unknown',
                                    'homeScore': int(hs) if str(hs).isdigit() else 0,
                                    'awayScore': int(as_) if str(as_).isdigit() else 0,
                                    'quarter': qtr,
                                    'clock': clock,
                                    'id': gid
                                })
                if games:
                    return json.dumps(games).encode('utf-8'), 'application/json'
        except Exception as e:
            try:
                print(f"RapidAPI fetch failed: {e}")
            except Exception:
                pass
            # fall through to ESPN

    # ESPN fallbacks (may require SSL trust and are unstable)
    # Build candidate URLs: week-based and date-based (7-day window)
    urls = [
        f"https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard?week={week}&seasontype=2&year={year}",
        f"https://site.api.espn.com/apis/v2/sports/football/nfl/scoreboard?week={week}&seasontype=2&year={year}",
        f"https://site.web.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard?week={week}&seasontype=2&year={year}",
    ]
    today = datetime.utcnow().date()
    for delta in range(-3, 4):
        d = today + timedelta(days=delta)
        ds = d.strftime('%Y%m%d')
        urls.append(f"https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard?dates={ds}")
        urls.append(f"https://site.web.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard?dates={ds}")
    last_err = None
    for url in urls:
        try:
            req = Request(url, headers={
                "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
                "Accept": "application/json, text/plain, */*",
                "Referer": "https://www.espn.com/",
                "Origin": "https://www.espn.com"
            })
            last_err = None
            for ctx in iter_ssl_contexts():
                try:
                    with urlopen(req, timeout=10, context=ctx) as resp:
                        raw = resp.read()
                        return raw, resp.getheader('Content-Type') or 'application/json'
                except Exception as e:
                    last_err = e
                    continue
            raise last_err or RuntimeError('ESPN HTTPS failed')
        except Exception as e:
            last_err = e
            try:
                print(f"Proxy fetch failed for {url}: {e}")
            except Exception:
                pass
            continue
    raise last_err or RuntimeError("Unable to fetch scoreboard")

class Handler(BaseHTTPRequestHandler):
    def _cors(self):
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')

    def do_OPTIONS(self):
        self.send_response(200)
        self._cors()
        self.end_headers()

    def do_GET(self):
        parsed = urlparse(self.path)
        if parsed.path == '/health':
            self.send_response(200)
            self._cors()
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            self.wfile.write(b'{"ok":true}')
            return

        if parsed.path == '/scoreboard':
            params = parse_qs(parsed.query)
            year = (params.get('year', [''])[0] or '').strip()
            week = (params.get('week', [''])[0] or '').strip()
            if not year or not week:
                self.send_response(400)
                self._cors()
                self.send_header('Content-Type', 'application/json')
                try:
                    self.end_headers()
                    self.wfile.write(b'{"error":"year and week required"}')
                except (BrokenPipeError, ConnectionResetError):
                    pass
                return
            try:
                data, content_type = fetch_scoreboard(year, week)
                self.send_response(200)
                self._cors()
                self.send_header('Content-Type', content_type)
                try:
                    self.end_headers()
                    self.wfile.write(data)
                except (BrokenPipeError, ConnectionResetError):
                    pass
            except Exception as e:
                self.send_response(502)
                self._cors()
                self.send_header('Content-Type', 'application/json')
                try:
                    self.end_headers()
                    payload = json.dumps({"error": str(e)}).encode('utf-8')
                    self.wfile.write(payload)
                except (BrokenPipeError, ConnectionResetError):
                    pass
            return

        self.send_response(404)
        self._cors()
        self.send_header('Content-Type', 'application/json')
        self.end_headers()
        self.wfile.write(b'{"error":"not found"}')

if __name__ == '__main__':
    print(f"Starting CORS proxy on http://0.0.0.0:{PORT}")
    HTTPServer(('', PORT), Handler).serve_forever()


