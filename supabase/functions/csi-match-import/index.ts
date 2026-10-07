import { createClient } from "npm:@supabase/supabase-js@2.57.0";

const supabaseUrl=Deno.env.get("SUPABASE_URL")!;
const adminKey=Deno.env.get("SUPABASE_SECRET_KEY")||Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const publicKey=Deno.env.get("SUPABASE_PUBLISHABLE_KEY")||Deno.env.get("SUPABASE_ANON_KEY")!;
const service=createClient(supabaseUrl,adminKey,{auth:{persistSession:false,autoRefreshToken:false}});
const cors={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization,apikey,content-type","Access-Control-Allow-Methods":"POST,OPTIONS","Content-Type":"application/json"};
const respond=(obj:unknown,status=200)=>new Response(JSON.stringify(obj),{status,headers:cors});
const clean=(v:unknown)=>String(v??"").trim();
const norm=(v:unknown)=>clean(v).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-z0-9]+/g," ").trim();
const side=(v:unknown)=>v==="home"||v==="away"?v:null;
const intOrNull=(v:unknown)=>Number.isInteger(Number(v))?Number(v):null;
const playerObject=(v:any)=>v&&typeof v==="object"?{name:clean(v.name)||null,number:intOrNull(v.number)}:null;

function validatePayload(raw:any){
 if(!raw||typeof raw!=="object"||Array.isArray(raw))throw new Error("JSON CSI non valido");
 if(!raw.home||!raw.away||typeof raw.home!=="object"||typeof raw.away!=="object")throw new Error("JSON CSI: squadre mancanti");
 if(!Array.isArray(raw.events))throw new Error("JSON CSI: events deve essere un array");
 const events=raw.events.map((ev:any,index:number)=>{
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
async function sha256(value:unknown){
 const bytes=new TextEncoder().encode(JSON.stringify(value));
 const digest=await crypto.subtle.digest("SHA-256",bytes);
 return Array.from(new Uint8Array(digest)).map(x=>x.toString(16).padStart(2,"0")).join("");
}

Deno.serve(async(req:Request)=>{
 if(req.method==="OPTIONS")return new Response("ok",{headers:cors});
 if(req.method!=="POST")return respond({error:"Metodo non consentito"},405);
 try{
  const token=(req.headers.get("authorization")||"").replace(/^Bearer\s+/i,"").trim();
  if(!token)return respond({error:"Non autenticato"},401);
  const authClient=createClient(supabaseUrl,publicKey,{auth:{persistSession:false,autoRefreshToken:false}});
  const {data:{user},error:authError}=await authClient.auth.getUser(token);
  if(authError||!user)return respond({error:"Non autenticato"},401);
  const {data:role}=await service.from("app_user_roles").select("role").eq("user_id",user.id).maybeSingle();
  if(!["admin","manager"].includes(role?.role||""))return respond({error:"Accesso riservato allo staff"},403);

  const body=await req.json().catch(()=>null);
  const fixtureId=typeof body?.fixture_id==="string"?body.fixture_id:"";
  if(!/^[0-9a-f-]{36}$/i.test(fixtureId))return respond({error:"Fixture non valida"},400);
  const payload=validatePayload(body?.payload);

  const {data:fixture,error:fixtureError}=await service.from("app_competition_fixtures")
   .select("id,season_id,home_team,away_team,match_code,source_url,home_score,away_score")
   .eq("id",fixtureId).maybeSingle();
  if(fixtureError)throw fixtureError;
  if(!fixture)return respond({error:"Partita non trovata"},404);
  if(fixture.match_code&&payload.code&&norm(fixture.match_code)!==norm(payload.code))
   return respond({error:`Codice gara non corrispondente: atteso ${fixture.match_code}, ricevuto ${payload.code}`},409);
  if(payload.home.name&&norm(payload.home.name)!==norm(fixture.home_team))
   return respond({error:`Squadra di casa non corrispondente: ${payload.home.name}`},409);
  if(payload.away.name&&norm(payload.away.name)!==norm(fixture.away_team))
   return respond({error:`Squadra ospite non corrispondente: ${payload.away.name}`},409);

  const {data:match}=await service.from("app_matches").select("id,result_review_status").eq("fixture_id",fixtureId).maybeSingle();
  const hash=await sha256(payload);
  const {data:existing}=await service.from("app_match_source_snapshots")
   .select("id,review_status,fetched_at").eq("fixture_id",fixtureId).eq("source","csi").eq("payload_hash",hash).maybeSingle();
  if(existing)return respond({ok:true,changed:false,snapshot_id:existing.id,review_status:existing.review_status,events:payload.events.length});

  const {data:snapshot,error:snapshotError}=await service.from("app_match_source_snapshots").insert({
   fixture_id:fixtureId,match_id:match?.id||null,source:"csi",source_url:fixture.source_url||"manual-json",
   source_match_code:payload.code||fixture.match_code,payload_hash:hash,review_status:"pending",
   home_score:payload.home.score,away_score:payload.away.score,raw_payload:payload,created_by:user.id
  }).select("id").single();
  if(snapshotError)throw snapshotError;

  if(payload.events.length){
   const rows=payload.events.map((ev:any,index:number)=>({
    snapshot_id:snapshot.id,event_ordinal:index,period:ev.period,minute:ev.minute,stoppage_minute:ev.stoppage_minute,
    source_team_side:ev.team,event_type:ev.type,player_name:ev.player?.name||null,shirt_number:ev.player?.number??null,
    player_out_name:ev.player_out?.name||null,player_out_number:ev.player_out?.number??null,
    player_in_name:ev.player_in?.name||null,player_in_number:ev.player_in?.number??null,
    score_home:ev.score?.home??null,score_away:ev.score?.away??null,raw_payload:ev,match_state:"unmatched"
   }));
   const {error:eventsError}=await service.from("app_match_source_events").insert(rows);
   if(eventsError)throw eventsError;
  }

  if(match?.id)await service.from("app_matches").update({result_review_status:"provisional",result_reviewed_at:null,result_reviewed_by:null}).eq("id",match.id);
  const {data:season}=await service.from("app_seasons").select("team_id").eq("id",fixture.season_id).maybeSingle();
  if(season?.team_id){
   const {data:recipients}=await service.from("app_user_roles").select("user_id,role").in("role",["admin","manager"]);
   if(recipients?.length){
    const score=payload.home.score!=null&&payload.away.score!=null?`${payload.home.score}–${payload.away.score}`:"risultato non disponibile";
    await service.from("team_notifications").insert(recipients.map((r:any)=>({
     team_id:season.team_id,recipient_profile_id:r.user_id,notification_type:"csi_review",title:"Revisione CSI importata",
     body:`${fixture.home_team} – ${fixture.away_team}: ${payload.events.length} eventi · ${score}`,
     entity_type:"fixture",entity_id:fixtureId
    })));
   }
  }
  return respond({ok:true,changed:true,snapshot_id:snapshot.id,events:payload.events.length});
 }catch(error){
  console.error("csi-match-import",error);
  return respond({error:error instanceof Error?error.message:"Import CSI non riuscito"},500);
 }
});