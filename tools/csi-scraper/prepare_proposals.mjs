// Converts parser output into bounded, SQL-escaped batches for the Supabase connector.
// Only the staging RPC / check status are written; match data is never updated here.
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {join} from 'node:path';
import {validatePayload} from '../../supabase/functions/_shared/csi-payload.js';
const rows=readFileSync(process.argv[2],'utf8').trim().split('\n').filter(Boolean).map(line=>JSON.parse(line));
const quote=value=>"'"+String(value).replaceAll("'","''")+"'";
const good=[],errors=[];
for(const row of rows){
 if(!/^[0-9a-f-]{36}$/i.test(row.fixture_id))throw Error('Invalid fixture ID');
 if(row.error){errors.push(row);continue}
 good.push({...row,payload:validatePayload(row.payload)});
}
const queries=[];
for(let i=0;i<good.length;i+=8){
 const batch=quote(JSON.stringify(good.slice(i,i+8)));
 queries.push(`select jsonb_agg(public.tm_csi_stage_snapshot((item->>'fixture_id')::uuid,item->>'source_url',item->'payload',null)) as results from jsonb_array_elements(${batch}::jsonb) item;`);
}
for(const row of errors){
 queries.push(`insert into public.app_match_source_checks(fixture_id,source_url,last_attempt_at,check_status,last_error) select id,source_url,now(),'error',${quote(row.error)} from public.app_competition_fixtures where id=${quote(row.fixture_id)}::uuid and source_url=${quote(row.source_url)} on conflict(fixture_id) do update set last_attempt_at=now(),check_status='error',last_error=excluded.last_error;`);
}
writeFileSync(process.argv[3],JSON.stringify({fixtures:rows.length,successful:good.length,errors:errors.length,queries},null,2));
const batchDir=process.argv[3]+'.batches';mkdirSync(batchDir,{recursive:true});
for(const [i,query] of queries.entries())writeFileSync(join(batchDir,String(i+1).padStart(3,'0')+'.json'),JSON.stringify(query));
console.log(JSON.stringify({fixtures:rows.length,successful:good.length,errors:errors.length,batches:queries.length}));
