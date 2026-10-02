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
 async with async_playwright() as playwright:
  browser=await playwright.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox','--no-proxy-server','--proxy-bypass-list=*'])
  async def run(width,height,prefix):
   page=await browser.new_page(viewport={'width':width,'height':height},device_scale_factor=1)
   errors=[]
   page.on('pageerror',lambda x:errors.append(str(x)))
   async def respond(route):
    table=urlsplit(route.request.url).path.rsplit('/',1)[-1]
    rows=TABLES.get(table,[])
    params=parse_qs(urlsplit(route.request.url).query)
    for key,value in params.items():
     if key not in ['select','order'] and value and value[0].startswith('eq.'):
      field=key;target=value[0][3:];rows=[x for x in rows if str(x.get(field))==target]
    await route.fulfill(status=200,content_type='application/json',body=__import__('json').dumps(rows),headers={'Access-Control-Allow-Origin':'*'})
   await page.route('**/rest/v1/**',respond)
   await page.goto('http://127.0.0.1:8080/',wait_until='domcontentloaded')
   await page.wait_for_function("document.querySelector('.hero-panel') !== null",timeout=10000)
   await page.screenshot(path=f'/mnt/data/team-manager-next-{prefix}.png',full_page=True)
   await page.locator('button[data-nav="competitions"]').first.click()
   await page.wait_for_selector('.standings-table')
   await page.locator('[data-fixture]').first.click()
   await page.wait_for_selector('dialog[open]')
   await page.locator('[data-match-tab="lineup"]').click()
   await page.locator('[data-close]').click()
   await page.locator('button[data-nav="roster"]').first.click()
   await page.wait_for_selector('.player-card')
   if width<801:
    await page.locator('[data-more]').click()
    await page.wait_for_selector('.more-menu-item')
   print(prefix,'rendered, navigated, modal and search passed','JS errors:',errors)
   assert not errors,errors
   await page.close()
  await run(1440,900,'desktop')
  await run(390,844,'mobile')
  await browser.close()
asyncio.run(main())
