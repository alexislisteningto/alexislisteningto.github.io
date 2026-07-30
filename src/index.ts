import { isRecord } from "./type-guards";

const LASTFM_API = "https://ws.audioscrobbler.com/2.0/";
const TURNSTILE_SITEVERIFY = "https://challenges.cloudflare.com/turnstile/v0/siteverify";
const MAX_RECOMMENDATION_BODY = 4096;

type JsonRecord = Record<string, unknown>;

function json(data: unknown, init: ResponseInit = {}): Response {
  const headers = new Headers(init.headers);
  headers.set("content-type", "application/json; charset=utf-8");
  headers.set("x-content-type-options", "nosniff");
  return Response.json(data, { ...init, headers });
}

function text(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function integer(value: unknown): number {
  const parsed = Number.parseInt(text(value), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

function records(value: unknown): JsonRecord[] {
  return Array.isArray(value) ? value.filter(isRecord) : [];
}

function nested(record: JsonRecord, ...keys: string[]): unknown {
  let current: unknown = record;
  for (const key of keys) {
    if (!isRecord(current)) return undefined;
    current = current[key];
  }
  return current;
}

function imageFrom(record: JsonRecord): string {
  const images = records(record.image);
  for (let index = images.length - 1; index >= 0; index -= 1) {
    const image = images[index];
    const url = image ? text(image["#text"]) : "";
    if (url) return url;
  }
  return "";
}

function artistFrom(value: unknown): string {
  if (typeof value === "string") return value;
  return isRecord(value) ? text(value["#text"] || value.name) : "";
}

function albumFrom(value: unknown): string {
  if (typeof value === "string") return value;
  return isRecord(value) ? text(value["#text"] || value.name) : "";
}

function lastFmUrl(env: Env, method: string, parameters: Record<string, string>): URL {
  const url = new URL(LASTFM_API);
  url.search = new URLSearchParams({
    method,
    user: env.LASTFM_USER,
    api_key: env.LASTFM_API_KEY,
    format: "json",
    ...parameters,
  }).toString();
  return url;
}

async function fetchLastFm(env: Env, method: string, parameters: Record<string, string>): Promise<JsonRecord> {
  const response = await fetch(lastFmUrl(env, method, parameters), {
    headers: { accept: "application/json" },
    signal: AbortSignal.timeout(8000),
  });
  if (!response.ok) throw new Error(`Last.fm ${method} returned ${response.status}`);

  const contentLength = Number(response.headers.get("content-length") || 0);
  if (contentLength > 2_000_000) throw new Error(`Last.fm ${method} response was too large`);

  const payload: unknown = await response.json();
  if (!isRecord(payload) || payload.error) throw new Error(`Last.fm ${method} returned an API error`);
  return payload;
}

function normalizeTrack(track: JsonRecord) {
  return {
    name: text(track.name),
    artist: artistFrom(track.artist),
    album: albumFrom(track.album),
    url: text(track.url),
    image: imageFrom(track),
  };
}

function normalizeAlbum(album: JsonRecord) {
  return {
    name: text(album.name),
    artist: artistFrom(album.artist),
    url: text(album.url),
    image: imageFrom(album),
    playcount: integer(album.playcount),
  };
}

async function musicResponse(env: Env): Promise<Response> {
  const [recentPayload, topPayload] = await Promise.all([
    fetchLastFm(env, "user.getrecenttracks", { limit: "9", extended: "0" }),
    fetchLastFm(env, "user.gettopalbums", { limit: "100", period: "overall" }),
  ]);

  const recentRecords = records(nested(recentPayload, "recenttracks", "track"));
  const topRecords = records(nested(topPayload, "topalbums", "album"));
  if (recentRecords.length === 0 || topRecords.length === 0) {
    throw new Error("Last.fm returned incomplete music data");
  }

  const recent = recentRecords.slice(0, 9).map(normalizeTrack);
  const currentRecord = recentRecords[0];
  const currentBase = currentRecord ? normalizeTrack(currentRecord) : null;
  const attributes = currentRecord && isRecord(currentRecord["@attr"]) ? currentRecord["@attr"] : {};
  const nowPlaying = text(attributes.nowplaying) === "true";
  let playcount = 0;

  if (currentBase) {
    try {
      const info = await fetchLastFm(env, "track.getInfo", {
        artist: currentBase.artist,
        track: currentBase.name,
      });
      playcount = integer(nested(info, "track", "userplaycount"));
    } catch (error) {
      console.warn(JSON.stringify({ event: "lastfm_track_info_failed", error: String(error) }));
    }
  }

  return json(
    {
      current: currentBase ? { ...currentBase, nowPlaying, playcount } : null,
      recent,
      topAlbums: topRecords.map(normalizeAlbum),
    },
    {
      headers: {
        "cache-control": "public, max-age=30, s-maxage=60, stale-while-revalidate=300",
      },
    },
  );
}

async function readJsonBody(request: Request): Promise<unknown> {
  const declaredLength = Number(request.headers.get("content-length") || 0);
  if (declaredLength > MAX_RECOMMENDATION_BODY) throw new Error("request_too_large");
  if (!request.body) throw new Error("missing_body");

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let length = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    length += value.byteLength;
    if (length > MAX_RECOMMENDATION_BODY) {
      await reader.cancel();
      throw new Error("request_too_large");
    }
    chunks.push(value);
  }

  const body = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }

  try {
    return JSON.parse(new TextDecoder().decode(body));
  } catch {
    throw new Error("invalid_json");
  }
}

function allowedHostnames(env: Env): Set<string> {
  return new Set(env.TURNSTILE_HOSTNAMES.split(",").map((hostname) => hostname.trim()).filter(Boolean));
}

async function verifyTurnstile(request: Request, env: Env, token: string): Promise<boolean> {
  const response = await fetch(TURNSTILE_SITEVERIFY, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      secret: env.TURNSTILE_SECRET,
      response: token,
      remoteip: request.headers.get("CF-Connecting-IP") || "",
    }),
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) return false;

  const result: unknown = await response.json();
  if (!isRecord(result)) return false;
  const requestHostname = new URL(request.url).hostname;
  const usesLocalTestKey = env.TURNSTILE_SITE_KEY === "1x00000000000000000000AA"
    && (requestHostname === "localhost" || requestHostname === "127.0.0.1");
  if (usesLocalTestKey) return result.success === true;

  const hostname = text(result.hostname);
  return result.success === true && text(result.action) === "recommend_music" && allowedHostnames(env).has(hostname);
}

function validDiscordWebhook(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && url.hostname === "discord.com" && url.pathname.startsWith("/api/webhooks/");
  } catch {
    return false;
  }
}

function allowedOrigins(env: Env): Set<string> {
  return new Set(env.ALLOWED_ORIGINS.split(",").map((origin) => origin.trim()).filter(Boolean));
}

function withCors(response: Response, request: Request, env: Env): Response {
  const origin = request.headers.get("origin");
  if (!origin || !allowedOrigins(env).has(origin)) return response;

  const corsResponse = new Response(response.body, response);
  corsResponse.headers.set("access-control-allow-origin", origin);
  corsResponse.headers.set("vary", "Origin");
  return corsResponse;
}

async function recommendResponse(request: Request, env: Env): Promise<Response> {
  if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/json")) {
    return json({ error: "send that as JSON" }, { status: 415 });
  }

  const origin = request.headers.get("origin");
  if (origin && !allowedOrigins(env).has(origin)) {
    return json({ error: "that request came from the wrong site" }, { status: 403 });
  }

  let payload: unknown;
  try {
    payload = await readJsonBody(request);
  } catch (error) {
    const tooLarge = error instanceof Error && error.message === "request_too_large";
    return json({ error: tooLarge ? "that's too long" : "couldn't read that" }, { status: tooLarge ? 413 : 400 });
  }

  if (!isRecord(payload)) return json({ error: "couldn't read that" }, { status: 400 });
  const recommendation = text(payload.recommendation).trim();
  const turnstileToken = text(payload.turnstileToken);
  if (recommendation.length === 0 || recommendation.length > 280) {
    return json({ error: "keep it between 1 and 280 characters" }, { status: 400 });
  }
  if (turnstileToken.length === 0 || turnstileToken.length > 2048) {
    return json({ error: "finish the spam check first" }, { status: 403 });
  }

  const actor = request.headers.get("CF-Connecting-IP") || "local-development";
  const rateLimit = await env.RECOMMEND_RATE_LIMITER.limit({ key: `recommend:${actor}` });
  if (!rateLimit.success) {
    return json({ error: "that's enough recommendations for one minute" }, { status: 429 });
  }

  let verified = false;
  try {
    verified = await verifyTurnstile(request, env, turnstileToken);
  } catch (error) {
    console.warn(JSON.stringify({ event: "turnstile_failed", error: String(error) }));
  }
  if (!verified) return json({ error: "the spam check didn't work" }, { status: 403 });

  if (!validDiscordWebhook(env.DISCORD_WEBHOOK_URL)) {
    console.error(JSON.stringify({ event: "discord_webhook_misconfigured" }));
    return json({ error: "recommendations are offline right now" }, { status: 503 });
  }

  try {
    const discord = await fetch(env.DISCORD_WEBHOOK_URL, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        content: recommendation,
        username: "alex is listening to",
        allowed_mentions: { parse: [] },
      }),
      signal: AbortSignal.timeout(8000),
    });
    if (!discord.ok) {
      console.error(JSON.stringify({ event: "discord_rejected", status: discord.status }));
      return json({ error: "discord didn't accept that. don't resend it yet." }, { status: 502 });
    }
  } catch (error) {
    console.error(JSON.stringify({ event: "discord_outcome_unknown", error: String(error) }));
    return json({ error: "discord didn't confirm that. don't resend it yet." }, { status: 502 });
  }

  return json({ ok: true });
}

async function apiResponse(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
  const url = new URL(request.url);

  if (request.method === "OPTIONS") {
    const origin = request.headers.get("origin");
    if (!origin || !allowedOrigins(env).has(origin)) return json({ error: "origin not allowed" }, { status: 403 });
    return new Response(null, {
      status: 204,
      headers: {
        "access-control-allow-headers": "content-type",
        "access-control-allow-methods": "GET, POST, OPTIONS",
        "access-control-max-age": "86400",
      },
    });
  }

  if (url.pathname === "/api/config") {
    if (request.method !== "GET") return json({ error: "method not allowed" }, { status: 405, headers: { allow: "GET" } });
    const localHostname = url.hostname === "localhost" || url.hostname === "127.0.0.1";
    if (env.TURNSTILE_SITE_KEY === "1x00000000000000000000AA" && !localHostname) {
      return json({ error: "recommendations are not configured" }, { status: 503 });
    }
    return json({ turnstileSiteKey: env.TURNSTILE_SITE_KEY }, { headers: { "cache-control": "public, max-age=300" } });
  }

  if (url.pathname === "/api/music") {
    if (request.method !== "GET") return json({ error: "method not allowed" }, { status: 405, headers: { allow: "GET" } });
    const cache = await caches.open("music");
    const cached = await cache.match(request);
    if (cached) return cached;

    try {
      const response = await musicResponse(env);
      ctx.waitUntil(cache.put(request, response.clone()));
      return response;
    } catch (error) {
      console.error(JSON.stringify({ event: "music_api_failed", error: String(error) }));
      return json({ error: "Last.fm isn't answering right now" }, { status: 502 });
    }
  }

  if (url.pathname === "/api/recommend") {
    if (request.method !== "POST") return json({ error: "method not allowed" }, { status: 405, headers: { allow: "POST" } });
    return recommendResponse(request, env);
  }

  return json({ error: "not found" }, { status: 404 });
}
export default {
  async fetch(request, env, ctx): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname.startsWith("/api/")) {
      return withCors(await apiResponse(request, env, ctx), request, env);
    }
    return env.ASSETS.fetch(request);
  },
} satisfies ExportedHandler<Env>;
