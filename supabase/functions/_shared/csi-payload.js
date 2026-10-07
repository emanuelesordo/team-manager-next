const clean=(v)=>String(v??"").trim();
const side=(v)=>v==="home"||v==="away"?v:null;
const intOrNull=(v)=>v===null||v===undefined||v===""?null:Number.isInteger(Number(v))?Number(v):null;
const playerObject=(v)=>v&&typeof v==="object"?{name:clean(v.name)||null,number:intOrNull(v.number)}:null;

export function validatePayload(raw){
 if(!raw||typeof raw!=="object"||Array.isArray(raw))throw new Error("JSON CSI non valido");
 if(!raw.home||!raw.away||typeof raw.home!=="object"||typeof raw.away!=="object")throw new Error("JSON CSI: squadre mancanti");
 if(!Array.isArray(raw.events))throw new Error("JSON CSI: events deve essere un array");
 const events=raw.events.map((ev,index)=>{
  if(!ev||typeof ev!=="object")throw new Error(`Evento CSI ${index+1} non valido`);
  const type=clean(ev.type);
  if(!["goal","yellow_card","blue_card","red_card","substitution","unknown"].includes(type))throw new Error(`Tipo evento CSI non valido: ${type||"vuoto"}`);
  const period=intOrNull(ev.period),minute=intOrNull(ev.minute),stoppage=intOrNull(ev.stoppage_minute);
  if(period!==null&&(period<1||period>8))throw new Error(`Periodo non valido all'evento ${index+1}`);
  if(minute!==null&&(minute<0||minute>300))throw new Error(`Minuto non valido all'evento ${index+1}`);
  if(stoppage!==null&&(stoppage<0||stoppage>60))throw new Error(`Recupero non valido all'evento ${index+1}`);
  return {
   period,minute,stoppage_minute:stoppage,team:side(ev.team),type,
   player:playerObject(ev.player),player_out:playerObject(ev.player_out),player_in:playerObject(ev.player_in),
   score:ev.score&&typeof ev.score==="object"?{home:intOrNull(ev.score.home),away:intOrNull(ev.score.away)}:null,
   icon:clean(ev.icon)||null,text:clean(ev.text)||null
  };
 });
 return {
  code:clean(raw.code)||null,date:clean(raw.date)||null,time:clean(raw.time)||null,status:clean(raw.status)||null,
  competition:raw.competition&&typeof raw.competition==="object"?raw.competition:null,
  venue:raw.venue&&typeof raw.venue==="object"?raw.venue:null,
  home:{name:clean(raw.home.name)||null,url:clean(raw.home.url)||null,logo:clean(raw.home.logo)||null,score:intOrNull(raw.home.score)},
  away:{name:clean(raw.away.name)||null,url:clean(raw.away.url)||null,logo:clean(raw.away.logo)||null,score:intOrNull(raw.away.score)},
  periods:Array.isArray(raw.periods)?raw.periods:[],events
 };
}
