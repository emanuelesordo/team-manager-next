/**
 * Team Manager data gateway — pure ESM, zero dependencies on the anonymous path.
 * Supabase Auth SDK is loaded only when signing in or recovering an existing session.
 * The existing database, RLS grants and Edge Functions are the source of truth.
 */
import { CONFIG } from './config.js';

let clientPromise;
let bearerToken = null;
const cache = new Map();
const API = `${CONFIG.supabaseUrl}/rest/v1`;
const headers = () => ({
  apikey: CONFIG.supabasePublishableKey,
  ...(bearerToken ? {Authorization: `Bearer ${bearerToken}`} : {}),
  Accept: 'application/json',
});

export function client() {
  if (!clientPromise) clientPromise = import('https://esm.sh/@supabase/supabase-js@2.57.0')
    .then(({ createClient }) => createClient(CONFIG.supabaseUrl, CONFIG.supabasePublishableKey, {
      auth: { autoRefreshToken: true, persistSession: true, detectSessionInUrl: false, storageKey: 'tm-next-session' },
      global: { headers: { 'X-Client-Info': 'team-manager-next/1.0' } },
    })).then(db => {
      db.auth.onAuthStateChange((_event, session) => {
        bearerToken = session?.access_token || null;
        clearCache();
      });
      return db;
    }).catch(err => { clientPromise = null; throw err; });
  return clientPromise;
}

export function clearCache() { cache.clear(); }

export async function read(table, columns, filters = [], order = null) {
  const url = new URL(`${API}/${table}`);
  url.searchParams.set('select', columns);
  for (const [field, value] of filters) url.searchParams.set(field, `eq.${value}`);
  if (order) url.searchParams.set('order', `${order.field}.${order.ascending ? 'asc' : 'desc'}`);
  const response = await fetch(url, { headers: headers(), signal: AbortSignal.timeout(12000), cache: 'no-store' });
  if (!response.ok) {
    const detail = await response.json().catch(() => ({}));
    throw new Error(`${table}: ${detail.message || `HTTP ${response.status}`}`);
  }
  return response.json();
}

async function cached(key, fetcher, ttl = 60000) {
  const current = cache.get(key);
  if (current && current.expires > Date.now()) return current.data;
  try {
    const data = await fetcher();
    cache.set(key, { data, expires: Date.now() + ttl });
    return data;
  } catch (error) {
    if (current) return current.data;
    throw error;
  }
}

async function settle(sources, prefix) {
  const out = {};
  await Promise.all(Object.entries(sources).map(async ([name, loader]) => {
    try { out[name] = await cached(`${prefix}:${name}`, loader); }
    catch (error) { out[name] = []; out[`${name}Error`] = error.message; }
  }));
  return out;
}

export function loadReference() {
  return settle({
    seasons: () => read('app_seasons', 'id,team_id,name,start_date,end_date,status', [], { field:'start_date', ascending:false }),
    teams: () => read('teams', 'id,name,short_name,logo_url'),
    opponents: () => read('app_opponents', 'id,name,short_name,logo_url,primary_color'),
  }, 'ref');
}

export function loadSeason(seasonId) {
  const filter = [['season_id', seasonId]];
  return settle({
    competitions: () => read('app_competitions', 'id,season_id,name,kind,format,periods,minutes_per_period', filter),
    fixtures: () => read('app_competition_fixtures', 'id,season_id,competition_id,round_no,kickoff_at,home_team,away_team,status,home_score,away_score,venue_name,venue_address', filter, { field:'kickoff_at', ascending:true }),
    standings: () => read('app_competition_standings', 'season_id,competition_id,team,played,won,drawn,lost,goals_for,goals_against,goal_difference,points', filter),
    roster: () => read('app_roster', 'id,season_id,player_id,shirt_number,active', filter),
    playerStats: () => read('app_player_season_stats', 'season_id,player_id,first_name,last_name,position_group,appearances,starts,minutes,goals,assists,yellow_cards,blue_cards,red_cards,avg_rating', filter),
    matches: () => read('app_matches', 'id,season_id,competition_id,opponent_id,kickoff_at,home_away,round_label,status,home_score,away_score,formation,live_period', filter),
    // Restrict anonymous reads to safe, column-granted attributes. Never SELECT *.
    players: () => read('players', 'id,first_name,last_name,photo_url,generic_role_manual'),
  }, `season:${seasonId}`);
}

export function getMatchDetail(id) {
  return settle({
    participants: () => read('app_match_players', 'id,match_id,player_id,selection_status,started,shirt_number,tactical_slot,is_captain,minutes_played', [['match_id',id]]),
    events: () => read('app_match_events', 'id,match_id,event_type,minute,stoppage_minute,player_id,secondary_player_id,team_side,validation_status,payload,created_at', [['match_id',id]], {field:'created_at',ascending:true}),
  }, `match:${id}`);
}

export async function signIn(username, password) {
  const response = await fetch(`${CONFIG.supabaseUrl}/functions/v1/auth-login`, {
    method:'POST', headers: { apikey: CONFIG.supabasePublishableKey, 'Content-Type':'application/json' },
    body: JSON.stringify({username:username.trim(),password}), signal:AbortSignal.timeout(15000), cache:'no-store',
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok || !result.ok) throw new Error(result.error || 'Autenticazione non disponibile');
  if (!result.session?.access_token || !result.session?.refresh_token) throw new Error('Sessione non valida');
  const db = await client();
  const { error } = await db.auth.setSession({access_token:result.session.access_token,refresh_token:result.session.refresh_token});
  if (error) throw error;
  bearerToken = result.session.access_token;
  clearCache();
  return result.profile;
}

export async function sessionInfo() {
  // Anonymous users do not download or evaluate the Auth SDK.
  if (!localStorage.getItem('tm-next-session')) return { session:null, role:null };
  const db = await client();
  const { data: { session }, error } = await db.auth.getSession();
  if (error || !session) { bearerToken = null; return { session:null, role:null }; }
  bearerToken = session.access_token;
  try {
    const roles = await read('app_user_roles', 'role,player_id', [['user_id',session.user.id]]);
    return { session, role:roles.find(r => r.role==='admin')?.role || roles[0]?.role || null, playerId:roles.find(r => r.player_id)?.player_id || null };
  } catch (err) { return { session, role:null, roleError:err.message }; }
}

export async function signOut() {
  const db = await client();
  await db.auth.signOut();
  bearerToken = null;
  clearCache();
}
