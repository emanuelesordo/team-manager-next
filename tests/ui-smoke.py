"""Optional browser smoke test: python -m playwright installed separately. Uses in-memory mocks only."""
import asyncio
from urllib.parse import urlsplit, parse_qs
from playwright.async_api import async_playwright

TEAM='d0c3210b-6a8a-4a1b-93c8-e2400029006e'
SEASON='810361d4-1d1e-4a53-b173-19885de43fa9'
COMP='8b8bf938-0ad9-4219-96bc-348750e84ed6'
FIXTURE='00000000-0000-0000-0000-000000000001'
MATCH='00000000-0000-0000-0000-000000000012'
PLAYER='00000000-0000-0000-0000-000000000021'
TABLES={
'app_seasons':[{'id':SEASON,'team_id':TEAM,'name':'2026/27','start_date':'2026-07-01','status':'active'}],
'teams':[{'id':TEAM,'name':'Calcio Caselle','short_name':'Caselle','logo_url':None}],
'app_opponents':[{'id':'o1','name':'Quadrato Meticcio','short_name':'Quadrato','logo_url':None}],
'app_competitions':[{'id':COMP,'season_id':SEASON,'name':'CSI - Serie B','kind':'league','format':'double_round'}],
'app_competition_fixtures':[
 {'id':FIXTURE,'season_id':SEASON,'competition_id':COMP,'round_no':5,'kickoff_at':'2026-10-05T20:30:00+02:00','home_team':'Calcio Caselle','away_team':'Quadrato Meticcio','status':'scheduled','home_score':None,'away_score':None},
 {'id':'f2','season_id':SEASON,'competition_id':COMP,'round_no':4,'kickoff_at':'2026-09-25T20:30:00+02:00','home_team':'Quadrato Meticcio','away_team':'Calcio Caselle','status':'finished','home_score':1,'away_score':3}],
'app_competition_standings':[{'season_id':SEASON,'competition_id':COMP,'team':'Calcio Caselle','played':4,'won':3,'drawn':0,'lost':1,'goals_for':9,'goals_against':4,'goal_difference':5,'points':9}, {'season_id':SEASON,'competition_id':COMP,'team':'Quadrato Meticcio','played':4,'won':2,'drawn':0,'lost':2,'goals_for':4,'goals_against':5,'goal_difference':-1,'points':6}],
'app_roster':[{'id':'r1','season_id':SEASON,'player_id':PLAYER,'shirt_number':7,'active':True}],
'app_player_season_stats':[{'season_id':SEASON,'player_id':PLAYER,'first_name':'Mario','last_name':'Rossi','position_group':'A','appearances':3,'goals':2,'starts':3,'minutes':230,'assists':1,'avg_rating':7.5}],
'app_matches':[{'id':MATCH,'season_id':SEASON,'competition_id':COMP,'opponent_id':'o1','kickoff_at':'2026-10-05T20:30:00+02:00','home_away':'home','status':'scheduled'}],
'players':[{'id':PLAYER,'first_name':'Mario','last_name':'Rossi','photo_url':None,'generic_role_manual':'A'}],
'app_match_players':[{'match_id':MATCH,'id':'part1','player_id':PLAYER,'shirt_number':7,'selection_status':'starter','started':True}],
'app_match_events':[],
}
async def main():
 from pathlib import Path
 p=Path(__file__).resolve().parent.parent
 html=(p/'index.html').read_text()
 css=(p/'src/styles.css').read_text()
 script=(p/'src/domain.js').read_text().replace('export ','')
 # Do not fake a remote backend: the visual smoke test explicitly injects
 # controlled fixtures and leaves actual backend queries to production.
 import json
 reference={"seasons":TABLES['app_seasons'],"teams":TABLES['teams'],"opponents":TABLES['app_opponents']}
 season={"competitions":TABLES['app_competitions'],"fixtures":TABLES['app_competition_fixtures'],"standings":TABLES['app_competition_standings'],"roster":TABLES['app_roster'],"playerStats":TABLES['app_player_season_stats'],"matches":TABLES['app_matches'],"players":TABLES['players']}
 stub=("const CONFIG="+json.dumps({"locale":"it-IT","timeZone":"Europe/Rome","fallbackTeamName":"Calcio Caselle","carouselDelayMs":7200})+";\n"
       +script+"\nconst loadReference=()=>Promise.resolve("+json.dumps(reference)+");\n"
       +"const loadSeason=()=>Promise.resolve("+json.dumps(season)+");\n"
       +"const getMatchDetail=()=>Promise.resolve("+json.dumps({"participants":TABLES['app_match_players'],"events":[]})+");\n"
       +"const clearCache=()=>{};const signIn=async()=>{};const signOut=async()=>{};"
       +"const sessionInfo=async()=>({session:null,role:null});\n")
 app=(p/'src/app.js').read_text()
 app='\n'.join(x for x in app.split('\n') if not x.startswith('import '))
 html=html.replace('<link rel="stylesheet" href="./src/styles.css">','<style>'+css+'</style>')
 html=html.replace('<script type="module" src="./src/app.js"></script>', '<script type="module">'+stub+app+'</script>')
 html=html.replace('<link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&family=Manrope:wght@400;500;600;700;800&display=swap" rel="stylesheet">','')
 async with async_playwright() as playwright:
  browser=await playwright.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox'])
  async def run(width,height,prefix):
   page=await browser.new_page(viewport={'width':width,'height':height},device_scale_factor=1)
   errors=[]
   page.on('pageerror',lambda error:errors.append(str(error)))
   await page.set_content(html,wait_until='domcontentloaded')
   await page.wait_for_selector('.hero-panel',timeout=10000)
   await page.wait_for_timeout(650)
   await page.screenshot(path=f'/mnt/data/team-manager-next-{prefix}.png',full_page=True)
   if width<801:
    assert await page.locator('.mobile-nav').is_visible()
    assert await page.locator('.sidebar').is_hidden()
    await page.locator('#moreMobile').click()
    await page.wait_for_selector('.more-menu-item')
    await page.locator('[data-close]').click()
   else:
    assert await page.locator('.sidebar').is_visible()
   await page.locator(("#mobileNav " if width<801 else "#desktopNav ")+"button[data-nav=\"competitions\"]").click()
   await page.wait_for_selector('.standings-table')
   await page.locator('[data-fixture]').first.click()
   await page.wait_for_selector('dialog[open]')
   await page.locator('[data-match-tab="lineup"]').click()
   await page.locator('[data-close]').click()
   await page.locator(("#mobileNav " if width<801 else "#desktopNav ")+"button[data-nav=\"roster\"]").click()
   await page.wait_for_selector('.player-card')
   print(prefix,'nav & modal passed; JS errors=',errors)
   assert not errors,errors
   await page.close()
  await run(1440,900,'desktop')
  await run(390,844,'mobile')
  await browser.close()
asyncio.run(main())
