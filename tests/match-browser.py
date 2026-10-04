"""Browser regression with stubbed APIs; never connects to production Supabase or uses real credentials.
Run: python -m pip install playwright && python -m playwright install chromium; python tests/match-browser.py
Serve repo root locally at http://127.0.0.1:8765, e.g. python3 -m http.server 8765.
"""
import asyncio
import base64
import json
import os
from urllib.parse import urlsplit
from playwright.async_api import async_playwright

USER = "aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa"
TEAM = "bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbbbb"
SEASON = "810361d4-1d1e-4a53-b173-19885de43fa9"
COMP = "8b8bf938-0ad9-4219-96bc-348750e84ed6"
FIXTURE = "bb86b6c8-e0f1-4ec1-8dd8-4e35c55f3139"
MATCH = "e6e870aa-8c21-4948-9b6d-fc3023cda2cb"
KICKOFF = "2026-09-28T19:00:00+00:00"
def uid(n):
 return f"00000000-0000-4000-8000-{n:012d}"

ROSTER = [{"player_id": uid(n), "season_id": SEASON, "active": True, "shirt_number": n} for n in range(1,22)]
PLAYERS = [{"id":uid(n),"team_id":TEAM,"first_name":"Test","last_name":f"Atleta{n:02d}","generic_role_manual":"C"} for n in range(1,22)]
PARTICIPANTS = [{"id":uid(100+n),"match_id":MATCH,"player_id":uid(n),"shirt_number":n,
 "started":n<=11,"selection_status":"starter" if n<=11 else "bench","tactical_slot":n if n<=11 else None} for n in range(1,22)]
EVENTS = [{"id":uid(200+n),"match_id":MATCH,"event_type":"goal" if n<=5 else "substitution",
 "minute":n+4,"player_id":uid(1+(n%11)),"secondary_player_id":None,
 "validation_status":"proposed","team_side":"team","created_at":"2026-09-28T19:00:00Z"} for n in range(1,17)]
TABLES = {
 "tm_public_teams":[{"id":TEAM,"name":"Calcio Caselle","short_name":"CAS","logo_url":None,"primary_color":"#24507a"}],
 "app_seasons":[{"id":SEASON,"team_id":TEAM,"name":"2026/27","status":"active","start_date":"2026-07-01","end_date":"2027-06-30"}],
 "app_opponents":[{"id":"opponent-01","name":"Voltesea Calcio","short_name":"VOL"}],
 "app_competitions":[{"id":COMP,"season_id":SEASON,"name":"Campionato","kind":"league","minutes_per_period":40}],
 "app_competition_fixtures":[{"id":FIXTURE,"season_id":SEASON,"competition_id":COMP,"round_no":1,"kickoff_at":KICKOFF,
 "home_team":"Voltesea Calcio","away_team":"Calcio Caselle","away_team_id":TEAM,"status":"finished","home_score":1,"away_score":4}],
 "app_matches":[{"id":MATCH,"fixture_id":FIXTURE,"season_id":SEASON,"competition_id":COMP,"opponent_id":"opponent-01",
 "home_away":"away","kickoff_at":KICKOFF,"status":"finished","home_score":0,"away_score":0}],
 "players":PLAYERS,"app_roster":ROSTER,"app_roster_periods":[{"id":uid(700+n),"season_id":SEASON,"player_id":uid(n),"start_date":"2026-07-01","end_date":"2027-06-30"} for n in range(1,22)],"app_match_players":PARTICIPANTS,"app_match_events":EVENTS,
 "app_user_roles":[{"user_id":USER,"role":"admin","player_id":None}],
 "profiles":[{"id":USER,"username":"demo","display_name":"Demo Admin","is_active":True,"must_change_password":False}],
}
TOKEN=".".join(["x",base64.urlsafe_b64encode(json.dumps({"sub":USER}).encode()).decode().rstrip("="),"sig"])
SESSION={"access_token":TOKEN,"refresh_token":"mock-refresh"}

async def test_view(browser, width, height):
 ctx=await browser.new_context(viewport={"width":width,"height":height},locale="it-IT")
 async def respond(route):
  url=urlsplit(route.request.url)
  name=url.path.rstrip("/").split("/")[-1]
  if name=="auth-login":
   payload={"ok":True,"session":SESSION,"profile":TABLES["profiles"][0]}
  elif name=="logout":
   payload={}
  else:
   payload=TABLES.get(name,[])
  await route.fulfill(status=200,content_type="application/json",body=json.dumps(payload))
 await ctx.route("**/rest/v1/**",respond)
 await ctx.route("**/functions/v1/**",respond)
 await ctx.route("**/auth/v1/**",respond)
 page=await ctx.new_page()
 errors=[]
 page.on("pageerror",lambda e:errors.append(str(e)))
 await page.goto("http://127.0.0.1:8765/",wait_until="domcontentloaded")
 await page.locator(".hero-panel").wait_for(timeout=20000)
 if width < 800:
  assert await page.locator(".mobile-nav").is_visible(),"Mobile navigation missing"
 else:
  assert await page.locator(".sidebar").is_visible(),"Desktop sidebar missing"
 await page.locator("button.user-btn[data-action=account]").click()
 await page.locator("#login-form input[name=username]").fill("demo")
 await page.locator("#login-form input[name=password]").fill("mock-password")
 await page.locator("#login-form button[type=submit]").click()
 await page.locator(".hero-panel").wait_for()
 # Open historical fixture and verify actual Match Center markup.
 await page.goto("http://127.0.0.1:8765/#competitions",wait_until="domcontentloaded")
 await page.locator("button[data-match]").first.click()
 await page.locator(".match-detail-head").wait_for(timeout=15000)
 assert page.url.endswith("#match/"+FIXTURE),page.url
 await page.locator('[data-tab="info"]').click()
 assert await page.locator('.match-info-editor').count()==1
 await page.locator('[data-tab="lineup"]').click()
 await page.locator('form[data-staff-form="lineup"]').wait_for(timeout=10000)
 await page.wait_for_function("document.querySelectorAll('form[data-staff-form=lineup] .field-slot.occupied').length === 11")
 assert await page.locator('[data-lineup-confirm]').count()==1
 await page.locator('[data-tab="overview"]').click()
 await page.wait_for_function("document.querySelectorAll('.ov-pitch .ov-player').length === 11")
 assert await page.locator(".ov-pitch .field-slot.occupied").count()==11
 await page.locator('[data-tab="events"]').click()
 await page.wait_for_function("document.querySelectorAll('.mt-row').length === 16")
 assert await page.locator(".mt-row").count()==16
 # Browser refresh must reconstruct the selected fixture and fetch match data.
 await page.reload(wait_until="domcontentloaded")
 await page.locator(".match-detail-head").wait_for(timeout=15000)
 assert page.url.endswith("#match/"+FIXTURE),page.url
 await page.locator('[data-tab="events"]').click()
 await page.wait_for_function("document.querySelectorAll('.mt-row').length === 16")
 await page.locator('[data-tab="overview"]').click()
 await page.wait_for_function("document.querySelectorAll('.ov-pitch .ov-player').length === 11")
 assert not errors,errors
 print(f"PASS {width}x{height}: login, linked lineup (11), events (16), refresh/deep link",flush=True)
 await ctx.close()

async def main():
 async with async_playwright() as pw:
  browser=await pw.chromium.launch(headless=True,args=["--no-sandbox"])
  try:
   await test_view(browser,1440,900)
   await test_view(browser,390,844)
  finally: await browser.close()
if __name__=="__main__": asyncio.run(main())
