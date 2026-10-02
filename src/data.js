const URL='https://qxblxomcpepwavgvhtuk.supabase.co';
const KEY='sb_publishable_mqNXt8rW96jH8JvCm24piA_SyAktT_m';
const headers={apikey:KEY,Authorization:'Bearer '+KEY};

async function table(name,params=''){
  const r=await fetch(URL+'/rest/v1/'+name+'?'+params,{headers});
  if(!r.ok) throw new Error(name+' '+r.status);
  return r.json();
}
export async function loadData(){
  const [teams,seasons,competitions,fixtures,standings,stats,roster,players]=await Promise.all([
    table('teams','select=id,name,short_name,logo_url,primary_color,secondary_color,accent_color,home_venue_name&order=created_at.asc&limit=1'),
    table('app_seasons','select=id,team_id,name,start_date,end_date,status&order=start_date.desc'),
    table('app_competitions','select=id,season_id,name,kind,format,periods,minutes_per_period&order=created_at.asc'),
    table('app_competition_fixtures','select=id,season_id,competition_id,round_no,kickoff_at,home_team,away_team,venue,venue_name,venue_address,status,home_score,away_score&order=kickoff_at.asc'),
    table('app_competition_standings','select=season_id,competition_id,team,played,won,drawn,lost,goals_for,goals_against,goal_difference,points'),
    table('app_player_season_stats','select=season_id,player_id,first_name,last_name,position_group,appearances,starts,minutes,goals,assists,yellow_cards,red_cards,avg_rating'),
    table('app_roster','select=id,season_id,player_id,shirt_number,active'),
    table('players','select=id,team_id,first_name,last_name,photo_url,generic_role_manual,preferred_foot,height_cm')
  ]);
  return {teams,seasons,competitions,fixtures,standings,stats,roster,players};
}