import { createClient } from "npm:@supabase/supabase-js@2.57.0";

function corsHeaders(req: Request) {
  const configured = Deno.env.get("ALLOWED_ORIGIN") ?? "*";
  const origin = req.headers.get("origin") ?? "";
  const allowOrigin =
    configured === "*"
      ? "*"
      : configured.split(",").map(v => v.trim()).includes(origin)
        ? origin
        : configured.split(",")[0].trim();

  return {
    "Access-Control-Allow-Origin": allowOrigin,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Content-Type": "application/json",
    "Vary": "Origin",
  };
}

function json(req: Request, data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: corsHeaders(req) });
}

function fail(req: Request, message: string, status = 400) {
  return json(req, { ok: false, error: message }, status);
}

function projectUrl() {
  const value = Deno.env.get("SUPABASE_URL");
  if (!value) throw new Error("SUPABASE_URL missing");
  return value;
}

function keyFromJsonMap(envName: string) {
  const raw = Deno.env.get(envName);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (typeof parsed === "string") return parsed;
    if (parsed?.default) return parsed.default;
    const first = Object.values(parsed ?? {}).find(v => typeof v === "string");
    return typeof first === "string" ? first : null;
  } catch {
    return null;
  }
}

function publishableKey() {
  const value =
    Deno.env.get("SUPABASE_PUBLISHABLE_KEY") ??
    keyFromJsonMap("SUPABASE_PUBLISHABLE_KEYS") ??
    Deno.env.get("SUPABASE_ANON_KEY");
  if (!value) throw new Error("Supabase publishable key missing");
  return value;
}

function secretKey() {
  const value =
    Deno.env.get("SUPABASE_SECRET_KEY") ??
    keyFromJsonMap("SUPABASE_SECRET_KEYS") ??
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!value) throw new Error("Supabase secret key missing");
  return value;
}

function serviceClient() {
  return createClient(projectUrl(), secretKey(), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function publicClient() {
  return createClient(projectUrl(), publishableKey(), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function slugPart(value: unknown) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, ".")
    .replace(/^\.+|\.+$/g, "");
}

function playerUsername(player: { first_name?: string | null; last_name?: string | null }) {
  return [slugPart(player.first_name), slugPart(player.last_name)].filter(Boolean).join(".");
}

async function loginWithAlias(req: Request, internalEmail: string, password: string, profile: any) {
  const client = publicClient();
  const { data, error } = await client.auth.signInWithPassword({
    email: internalEmail,
    password,
  });
  if (error || !data.session) return fail(req, "credenziali non valide", 401);

  return json(req, {
    ok: true,
    session: {
      access_token: data.session.access_token,
      refresh_token: data.session.refresh_token,
      expires_in: data.session.expires_in,
      expires_at: data.session.expires_at,
    },
    profile: {
      id: profile.id,
      display_name: profile.display_name,
      must_change_password: profile.must_change_password,
    },
  });
}

async function registerLinkedPlayer(req: Request, normalized: string, password: string) {
  if (password.length < 10 || password.length > 128) {
    return fail(req, "Per il primo accesso scegli una password da 10 a 128 caratteri", 400);
  }

  const admin = serviceClient();
  const { data: candidates, error: playersError } = await admin
    .from("players")
    .select("id,team_id,first_name,last_name,profile_id")
    .is("profile_id", null);

  if (playersError) throw playersError;

  const matches = (candidates ?? []).filter(player => playerUsername(player) === normalized);
  if (matches.length !== 1) return fail(req, "credenziali non valide", 401);

  const player = matches[0];
  let createdUserId: string | null = null;

  try {
    const internalEmail = `${crypto.randomUUID()}@users.invalid`;
    const displayName = [player.first_name, player.last_name].filter(Boolean).join(" ").trim() || normalized;

    const { data: created, error: createError } = await admin.auth.admin.createUser({
      email: internalEmail,
      password,
      email_confirm: true,
      user_metadata: { username: normalized, display_name: displayName },
    });
    if (createError || !created.user) throw createError ?? new Error("create user failed");
    createdUserId = created.user.id;

    const { error: profileError } = await admin.from("profiles").insert({
      id: createdUserId,
      username: normalized,
      display_name: displayName,
      first_name: player.first_name ?? null,
      last_name: player.last_name ?? null,
      is_active: true,
      must_change_password: false,
    });
    if (profileError) throw profileError;

    const { error: aliasError } = await admin.from("auth_aliases").insert({
      auth_user_id: createdUserId,
      internal_email: internalEmail,
    });
    if (aliasError) throw aliasError;

    const { data: member, error: memberError } = await admin
      .from("team_members")
      .insert({ team_id: player.team_id, profile_id: createdUserId })
      .select("id")
      .single();
    if (memberError) throw memberError;

    const { data: fanRole, error: roleLookupError } = await admin
      .from("roles")
      .select("id")
      .eq("code", "fan")
      .maybeSingle();
    if (roleLookupError) throw roleLookupError;
    if (fanRole?.id) {
      const { error: memberRoleError } = await admin.from("team_member_roles").insert({
        team_member_id: member.id,
        role_id: fanRole.id,
        active: true,
      });
      if (memberRoleError) throw memberRoleError;
    }

    // The profiles trigger private.tm_profile_link_trigger() performs the
    // canonical username -> player link and upserts app_user_roles.
    const { data: linkedPlayer, error: linkedPlayerError } = await admin
      .from("players")
      .select("id,profile_id")
      .eq("id", player.id)
      .maybeSingle();
    if (linkedPlayerError) throw linkedPlayerError;
    if (linkedPlayer?.profile_id !== createdUserId) {
      throw new Error("collegamento giocatore non riuscito");
    }

    return await loginWithAlias(req, internalEmail, password, {
      id: createdUserId,
      display_name: displayName,
      must_change_password: false,
    });
  } catch (error) {
    if (createdUserId) {
      await admin.from("players").update({ profile_id: null }).eq("profile_id", createdUserId);
      await admin.from("app_user_roles").delete().eq("user_id", createdUserId);
      const { data: members } = await admin.from("team_members").select("id").eq("profile_id", createdUserId);
      for (const member of members ?? []) {
        await admin.from("team_member_roles").delete().eq("team_member_id", member.id);
      }
      await admin.from("team_members").delete().eq("profile_id", createdUserId);
      await admin.from("auth_aliases").delete().eq("auth_user_id", createdUserId);
      await admin.from("profiles").delete().eq("id", createdUserId);
      try { await admin.auth.admin.deleteUser(createdUserId); } catch (_) {}
    }
    throw error;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders(req) });
  if (req.method !== "POST") return fail(req, "method not allowed", 405);

  try {
    const body = await req.json();
    const normalized = String(body.username ?? "").trim().toLowerCase();
    const password = String(body.password ?? "");

    if (!normalized || !password) return fail(req, "username e password obbligatori");
    if (!/^[a-z0-9._'-]{3,64}$/.test(normalized)) return fail(req, "credenziali non valide", 401);

    const admin = serviceClient();
    const { data: profile, error: profileError } = await admin
      .from("profiles")
      .select("id,is_active,must_change_password,display_name")
      .eq("username", normalized)
      .maybeSingle();

    if (profileError) throw profileError;

    if (!profile) {
      return await registerLinkedPlayer(req, normalized, password);
    }

    if (!profile.is_active) return fail(req, "credenziali non valide", 401);

    const { data: alias, error: aliasError } = await admin
      .from("auth_aliases")
      .select("internal_email")
      .eq("auth_user_id", profile.id)
      .maybeSingle();

    if (aliasError) throw aliasError;
    if (!alias) return fail(req, "account non configurato", 500);

    return await loginWithAlias(req, alias.internal_email, password, profile);
  } catch (error) {
    console.error(error);
    return fail(req, error instanceof Error ? error.message : "login error", 500);
  }
});
