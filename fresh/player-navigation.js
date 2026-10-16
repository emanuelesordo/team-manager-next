/**
 * Player profile navigation follows the season roster, in surname order.
 * It intentionally ignores temporary search/role filters, allowing traversal
 * across every player registered in the selected season.
 */
export function playerNavigation(players=[],roster=[],selectedId=null){
 const ids=new Set((roster||[]).map(row=>String(row?.player_id??'')).filter(Boolean));
 const seen=new Set();
 const available=(players||[]).filter(player=>{
  const id=String(player?.id??'');
  if(!id||!ids.has(id)||seen.has(id))return false;
  seen.add(id);return true;
 });
 const name=p=>String(p?.last_name||'')+' '+String(p?.first_name||'');
 available.sort((a,b)=>name(a).localeCompare(name(b),'it',{sensitivity:'base',numeric:true})||
  String(a.id).localeCompare(String(b.id)));
 const index=available.findIndex(player=>String(player.id)===String(selectedId));
 return {
  previous:index>0?available[index-1]:null,
  next:index>=0&&index<available.length-1?available[index+1]:null,
  position:index>=0?index+1:0,
  total:available.length
 };
}
