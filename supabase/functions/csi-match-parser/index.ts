import { createClient } from "npm:@supabase/supabase-js@2.57.0";
import * as cheerio from "npm:cheerio@1.0.0";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const adminKey = Deno.env.get("SUPABASE_SECRET_KEY") || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const publicKey = Deno.env.get("SUPABASE_PUBLISHABLE_KEY") || Deno.env.get("SUPABASE_ANON_KEY")!;
const service = createClient(supabaseUrl, adminKey, { auth: { persistSession: false, autoRefreshToken: false } });

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization,apikey,content-type",
  "Access-Control-Allow-Methods": "POST,OPTIONS",
  "Content-Type": "application/json"
};
const respond = (obj: unknown, status = 200) => new Response(JSON.stringify(obj), { status, headers: cors });
const text = (value: unknown) => String(value ?? "").replace(/\s+/g, " ").trim() || null;
const intValue = (value: unknown) => {
  const m = String(value ?? "").match(/-?\d+/);
  return m ? Number(m[0]) : null;
};
const absolute = (href: string | undefined | null, base: string) => {
  if (!href) return null;
  try { return new URL(href, base).href; } catch { return null; }
};
const player = (fragment: string | null) => {
  const cleaned = String(fragment ?? "").replace(/^\s*(Esce|Entra)\s*:\s*/i, "").trim();
  if (!cleaned) return null;
  const m = cleaned.match(/^(.*?)\s*\((\d+)\)\s*$/);
  return m ? { name: m[1].trim(), number: Number(m[2]) } : { name: cleaned, number: null };
};
const playerFrom = ($: cheerio.CheerioAPI, el: cheerio.Cheerio<any>) => player(text(el.text()));

function eventType(classes: string) {
  const list = classes.split(/\s+/);
  if (list.includes("fa-futbol")) return "goal";
  if (list.includes("fa-exchange")) return "substitution";
  if (list.includes("fa-rectangle-portrait")) {
    if (list.includes("text-danger")) return "red_card";
    if (list.includes("text-warning")) return "yellow_card";
    if (list.includes("text-info")) return "blue_card";
  }
  return "unknown";
}

function parseMatch(html: string, url: string, halfLength: number) {
  const $ = cheerio.load(html);
  const hero = $(".hero-gara").first();
  if (!hero.length) throw new Error("Pagina CSI non riconosciuta");

  let date: string | null = null;
  let time: string | null = null;
  const pill = text(hero.find(".rounded-pill").first().text()) || "";
  const d = pill.match(/(\d{2})\/(\d{2})\/(\d{4})/);
  const t = pill.match(/\b(\d{1,2}:\d{2})\b/);
  if (d) date = `${d[3]}-${d[2]}-${d[1]}`;
  if (t) time = t[1];

  const teamCols = hero.find(".row > .col-md-4");
  if (teamCols.length < 2) throw new Error("Squadre CSI non trovate");
  const parseTeam = (i: number) => {
    const col = teamCols.eq(i);
    const link = col.find("h5 a").first();
    const img = col.find("img").first();
    return {
      name: text(link.text()) || text(col.find("h5").first().text()),
      url: absolute(link.attr("href"), url),
      logo: img.attr("src") || null,
      score: null as number | null
    };
  };
  const home = parseTeam(0), away = parseTeam(1);

  const scoreCol = hero.find(".row > .col-md-3").first();
  const status = text(scoreCol.find(".badge").first().text());
  const scores = scoreCol.find("h3 > span").toArray().map(el => text($(el).text()))
    .filter(v => v && v !== "-").map(v => intValue(v)).filter(v => v !== null) as number[];
  if (scores.length === 2) { home.score = scores[0]; away.score = scores[1]; }

  const labeledValue = (label: string) => {
    let found: cheerio.Cheerio<any> | null = null;
    hero.find("b").each((_, el) => {
      if (found) return;
      const v = (text($(el).text()) || "").replace(/:$/, "").trim().toLowerCase();
      if (v === label.toLowerCase()) found = $(el).parent();
    });
    return found;
  };

  const codeBox = labeledValue("Codice gara");
  let code: string | null = null;
  if (codeBox) {
    const clone = cheerio.load(codeBox.html() || "");
    clone("b").remove();
    code = text(clone.root().text());
  }

  const venueBox = labeledValue("Campo");
  let venue: {name:string|null,url:string|null}|null = null;
  if (venueBox) {
    const link = venueBox.find("a").first();
    venue = { name: text(link.text()) || text(venueBox.text()), url: absolute(link.attr("href"), url) };
  }

  const crumbs = $("ol.breadcrumb li.breadcrumb-item").toArray()
    .map(el => text($(el).find("a").first().text())).filter(Boolean) as string[];
  const competition = { committee: crumbs[0] || null, sport: crumbs[1] || null, name: crumbs[2] || null };

  const firstRow = $(".event-row").first();
  const blocks: Array<{label:string|null,stoppage_minutes:number|null,rows:any[]}> = [];
  if (firstRow.length) {
    const container = firstRow.parent();
    let current: {label:string|null,stoppage_minutes:number|null,rows:any[]}|null = null;
    container.children().each((_, el) => {
      const node = $(el), classes = (node.attr("class") || "").split(/\s+/);
      if (classes.includes("event-header")) {
        current = { label: text(node.text()), stoppage_minutes: null, rows: [] };
        blocks.push(current);
      } else if (classes.includes("event-header-info")) {
        if (current) current.stoppage_minutes = intValue(text(node.text()));
      } else if (classes.includes("event-row")) {
        if (!current) { current = { label: null, stoppage_minutes: null, rows: [] }; blocks.push(current); }
        current.rows.push(el);
      }
    });
  }

  const periods:any[] = [], events:any[] = [];
  [...blocks].reverse().forEach((block, reverseIndex) => {
    const period = reverseIndex + 1;
    periods.push({ period, label: block.label, stoppage_minutes: block.stoppage_minutes });
    [...block.rows].reverse().forEach(el => {
      const row = $(el);
      const details = row.find(".event-details").first();
      const detailClasses = (details.attr("class") || "").split(/\s+/);
      const team = detailClasses.includes("event-left") ? "home" : detailClasses.includes("event-right") ? "away" : null;
      const icon = row.find(".event-icon i").first();
      const rawIcon = icon.attr("class") || null;
      const type = eventType(rawIcon || "");
      const siteMinute = intValue(text(row.find(".event-time").first().text()));
      const offset = halfLength * (period - 1);
      let minute: number|null = null, stoppage_minute: number|null = null;
      if (siteMinute !== null) {
        if (siteMinute > halfLength) { minute = offset + halfLength; stoppage_minute = siteMinute - halfLength; }
        else minute = offset + siteMinute;
      }
      const event:any = { period, minute, stoppage_minute, site_minute: siteMinute, team, type };
      if (type === "goal") {
        const scoreText = text(details.find("h6").first().text()) || "";
        const sm = scoreText.match(/^(\d+)\s*-\s*(\d+)$/);
        event.score = sm ? { home: Number(sm[1]), away: Number(sm[2]) } : null;
      } else if (type === "substitution") {
        const outEl = details.find(".player_out").first();
        event.player_out = outEl.length ? playerFrom($, outEl) : null;
        const clone = details.clone();
        clone.find(".player_out").remove();
        event.player_in = player(text(clone.text()));
      } else {
        event.player = details.length ? playerFrom($, details) : null;
        if (type === "unknown") { event.icon = rawIcon; event.text = text(details.text()); }
      }
      events.push(event);
    });
  });

  return { url, code, date, time, competition, venue, status, home, away, periods, events };
}

async function sha256(value: unknown) {
  const bytes = new TextEncoder().encode(JSON.stringify(value));
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest)).map(x => x.toString(16).padStart(2, "0")).join("");
}

export default {
  async fetch(req: Request) {
    if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
    if (req.method !== "POST") return respond({ error: "Metodo non consentito" }, 405);
    try {
      const token = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "").trim();
      if (!token) return respond({ error: "Non autenticato" }, 401);

      const authClient = createClient(supabaseUrl, publicKey, { auth: { persistSession: false, autoRefreshToken: false } });
      const { data: { user }, error: authError } = await authClient.auth.getUser(token);
      if (authError || !user) return respond({ error: "Non autenticato" }, 401);
      const { data: role } = await service.from("app_user_roles").select("role").eq("user_id", user.id).maybeSingle();
      if (!["admin", "manager"].includes(role?.role || "")) return respond({ error: "Accesso riservato allo staff" }, 403);

      const body = await req.json().catch(() => ({}));
      const fixtureId = typeof body.fixture_id === "string" ? body.fixture_id : "";
      if (!/^[0-9a-f-]{36}$/i.test(fixtureId)) return respond({ error: "Fixture non valida" }, 400);

      const { data: fixture, error: fixtureError } = await service.from("app_competition_fixtures")
        .select("id,season_id,competition_id,home_team,away_team,match_code,source_url,status,home_score,away_score")
        .eq("id", fixtureId).maybeSingle();
      if (fixtureError) throw fixtureError;
      if (!fixture) return respond({ error: "Partita non trovata" }, 404);
      if (!fixture.source_url || !String(fixture.source_url).startsWith("https://live.centrosportivoitaliano.it/"))
        return respond({ error: "URL CSI non disponibile per questa partita" }, 409);

      const [{ data: match }, { data: competition }, { data: season }] = await Promise.all([
        service.from("app_matches").select("id,result_review_status,minutes_per_period_override").eq("fixture_id", fixtureId).maybeSingle(),
        service.from("app_competitions").select("minutes_per_period").eq("id", fixture.competition_id).maybeSingle(),
        service.from("app_seasons").select("team_id").eq("id", fixture.season_id).maybeSingle()
      ]);
      const halfLength = Number(match?.minutes_per_period_override || competition?.minutes_per_period || 40);

      const response = await fetch(fixture.source_url, {
        headers: { "User-Agent": "Mozilla/5.0 (compatible; TeamManagerNext/1.0; +https://github.com/emanuelesordo/team-manager-next)" },
        redirect: "follow"
      });
      if (!response.ok) return respond({ error: "CSI non raggiungibile", status: response.status }, 502);

      const payload = parseMatch(await response.text(), fixture.source_url, halfLength);
      if (fixture.match_code && payload.code && fixture.match_code !== payload.code)
        return respond({ error: "Codice gara CSI non corrispondente", expected: fixture.match_code, actual: payload.code }, 409);

      const hash = await sha256(payload);
      const { data: existing } = await service.from("app_match_source_snapshots")
        .select("id,review_status,fetched_at").eq("fixture_id", fixtureId).eq("source", "csi").eq("payload_hash", hash).maybeSingle();
      if (existing) return respond({ ok: true, changed: false, snapshot_id: existing.id, review_status: existing.review_status, payload });

      const { data: snapshot, error: snapshotError } = await service.from("app_match_source_snapshots").insert({
        fixture_id: fixtureId, match_id: match?.id || null, source: "csi", source_url: fixture.source_url,
        source_match_code: payload.code || fixture.match_code, payload_hash: hash, review_status: "pending",
        home_score: payload.home?.score ?? null, away_score: payload.away?.score ?? null,
        raw_payload: payload, created_by: user.id
      }).select("id").single();
      if (snapshotError) throw snapshotError;

      if (payload.events.length) {
        const rows = payload.events.map((ev:any, index:number) => ({
          snapshot_id: snapshot.id, event_ordinal: index, period: ev.period ?? null, minute: ev.minute ?? null,
          stoppage_minute: ev.stoppage_minute ?? null, source_team_side: ev.team ?? null, event_type: ev.type,
          player_name: ev.player?.name ?? null, shirt_number: ev.player?.number ?? null,
          player_out_name: ev.player_out?.name ?? null, player_out_number: ev.player_out?.number ?? null,
          player_in_name: ev.player_in?.name ?? null, player_in_number: ev.player_in?.number ?? null,
          score_home: ev.score?.home ?? null, score_away: ev.score?.away ?? null, raw_payload: ev, match_state: "unmatched"
        }));
        const { error: eventsError } = await service.from("app_match_source_events").insert(rows);
        if (eventsError) throw eventsError;
      }

      if (match?.id) {
        await service.from("app_matches").update({
          result_review_status: "provisional", result_reviewed_at: null, result_reviewed_by: null
        }).eq("id", match.id);
      }

      if (season?.team_id) {
        const { data: recipients } = await service.from("app_user_roles").select("user_id,role").in("role", ["admin","manager"]);
        if (recipients?.length) {
          const score = payload.home?.score != null && payload.away?.score != null ? `${payload.home.score}–${payload.away.score}` : "risultato non disponibile";
          await service.from("team_notifications").insert(recipients.map((r:any) => ({
            team_id: season.team_id, recipient_profile_id: r.user_id, notification_type: "csi_review",
            title: "Verifica CSI richiesta",
            body: `${fixture.home_team} – ${fixture.away_team}: ${payload.events.length} eventi rilevati · ${score}`,
            entity_type: "fixture", entity_id: fixtureId
          })));
        }
      }

      return respond({ ok: true, changed: true, snapshot_id: snapshot.id, events: payload.events.length, payload });
    } catch (error) {
      console.error("csi-match-parser", error);
      return respond({ error: error instanceof Error ? error.message : "Import CSI non riuscito" }, 500);
    }
  }
};
