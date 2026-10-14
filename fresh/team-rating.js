import {matchPlayerIntervals} from './player-participation.js?v=20261014periodpriority1';

/** A completed weighted team rating consumes the same verified match minutes
 * used for the roster. Unverifiable participation never receives invented
 * weights from declared recovery or absent match-player minutes.
 */
export function weightedTeamRating({match,matchPlayers=[],events=[],ratings=[],competition={}}={}){
 if(!match)return null;
 const timeline=matchPlayerIntervals(match,matchPlayers,events,competition);
 if(!timeline.valid)return null;
 const grouped=new Map();
 for(const r of ratings){
  const value=Number(r.rating);
  if(r.rating===null||r.rating===undefined||r.rating===''||!Number.isFinite(value)||value<1||value>10)continue;
  const id=String(r.player_id||'');
  if(!id)continue;
  const row=grouped.get(id)||{sum:0,count:0};
  row.sum+=value;row.count++;grouped.set(id,row);
 }
 let total=0,weight=0;
 for(const [id,row] of grouped){
  const minutes=timeline.players.get(id)?.minutes;
  if(minutes===null||minutes===undefined)return null;
  if(minutes<=0)continue;
  total+=(row.sum/row.count)*minutes;weight+=minutes;
 }
 return weight>0?total/weight:null;
}
