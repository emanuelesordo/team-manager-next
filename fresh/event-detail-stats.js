/* Distribuzioni descrittive: solo eventi confermati, mai una seconda fonte di gol ufficiali. */
export const DETAIL_METRICS=[
 ['body_part','Parte del corpo',[['foot','Piede'],['knee','Ginocchio'],['head','Testa']]],
 ['play_type','Tipo di gioco',[['open_play','Azione'],['corner','Calcio d’angolo'],['penalty','Rigore'],['free_kick','Punizione']]],
 ['dynamics','Dinamica',[['counterattack','Contropiede'],['cross','Su cross'],['rebound','Su ribattuta'],['shot','Tiro'],['scramble','In mischia'],['tap_in','Tap-in'],['direct_free_kick','Tiro su punizione'],['personal_action','Azione personale']]],
 ['distance_zone','Distanza del tiro',[['goal_area','Area del portiere'],['penalty_area','Area di rigore'],['16_25','16–25 m'],['26_35','26–35 m'],['over_35','Oltre 35 m']]],
 ['disciplinary_reason','Motivi cartellini',[['protest','Proteste'],['foul','Fallo'],['violent_conduct','Condotta violenta'],['unsporting','Comportamento antisportivo'],['other','Altro']]],
 ['substitution_motivation','Motivi sostituzioni',[['injury','Infortunio'],['physical_precaution','Precauzione fisica'],['disciplinary_precaution','Precauzione disciplinare'],['energy','Energia'],['technical_tactical','Tecnico/tattico']]]
];
const GOALS=new Set(['goal','own_goal','penalty_scored','penalty_goal']);
const CARDS=new Set(['yellow_card','blue_card','red_card','second_yellow']);
export function aggregateEventDetails(events=[],{playerId=null,side=null}={}){
 const result={};
 for(const [key,title,options] of DETAIL_METRICS)result[key]={title,counts:Object.fromEntries(options.map(([value])=>[value,0])),known:0,unknown:0,total:0};
 const distances={shot:[],assist:[]};
 const seen=new Set();
 for(const ev of events){
  if(!['official','community_confirmed'].includes(ev?.validation_status)||ev.payload?.counted_in_score===false||ev?.is_test)continue;
  if(ev.id!=null){if(seen.has(String(ev.id)))continue;seen.add(String(ev.id));}
  if(side&&ev.team_side!==side)continue;
  const isGoal=GOALS.has(ev.event_type),isCard=CARDS.has(ev.event_type),isSub=ev.event_type==='substitution';
  if(!isGoal&&!isCard&&!isSub)continue;
  // Il marcatore di un autogol non è un gol a favore del proprio giocatore.
  if(playerId!=null&&String(ev.player_id??'')!==String(playerId))continue;
  const detail=ev.payload?.goal_details||{};
  for(const [key,,options] of DETAIL_METRICS){
   if((key==='disciplinary_reason'&&!isCard)||(key==='substitution_motivation'&&!isSub)||(!['disciplinary_reason','substitution_motivation'].includes(key)&&!isGoal))continue;
   const value=key==='disciplinary_reason'?ev.payload?.disciplinary_reason:key==='substitution_motivation'?ev.payload?.substitution_motivation:detail[key];
   const bucket=result[key];
   bucket.total++;
   if(options.some(([k])=>k===value)){bucket.counts[value]++;bucket.known++;}
   else bucket.unknown++;
  }
  if(isGoal){
   for(const which of ['shot','assist']){
    const point=detail[which];
    if(point&&Number.isFinite(Number(point.x))&&Number.isFinite(Number(point.y))&&Number(point.x)>=0&&Number(point.x)<=68&&Number(point.y)>=0&&Number(point.y)<=105)distances[which].push({x:Number(point.x),y:Number(point.y)});
   }
  }
 }
 return {groups:result,points:distances};
}
