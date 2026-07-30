import { env, exports } from "cloudflare:workers";
import { afterEach, describe, expect, it, vi } from "vitest";

const endpoint = "http://localhost/api/recommend";

function send(body: unknown, headers: HeadersInit = {}): Promise<Response> {
  return exports.default.fetch(endpoint, {
    method: "POST",
    headers: { "content-type": "application/json", origin: "http://localhost", ...headers },
    body: JSON.stringify(body),
  });
}

function successfulTurnstile(): Response {
  return Response.json({ success: true, hostname: "example.com" });
}

afterEach(() => {
  vi.restoreAllMocks();
});

it("does not expose a development Turnstile key on public hosts", async () => {
  const response = await exports.default.fetch("https://example.com/api/config");
  expect(response.status).toBe(503);
});

describe("GitHub Pages API access", () => {
  it("allows the production site to read public config", async () => {
    const response = await exports.default.fetch("http://localhost/api/config", {
      headers: { origin: "https://alexislisteningto.github.io" },
    });

    expect(response.status).toBe(200);
    expect(response.headers.get("access-control-allow-origin")).toBe("https://alexislisteningto.github.io");
  });

  it("answers recommendation preflight requests", async () => {
    const response = await exports.default.fetch(endpoint, {
      method: "OPTIONS",
      headers: {
        origin: "https://alexislisteningto.github.io",
        "access-control-request-method": "POST",
        "access-control-request-headers": "content-type",
      },
    });

    expect(response.status).toBe(204);
    expect(response.headers.get("access-control-allow-origin")).toBe("https://alexislisteningto.github.io");
    expect(response.headers.get("access-control-allow-methods")).toContain("POST");
  });

  it("rejects recommendation posts from other origins", async () => {
    const outbound = vi.spyOn(globalThis, "fetch");
    const response = await send(
      { recommendation: "Talk Talk, Spirit of Eden", turnstileToken: "token" },
      { origin: "https://example.com" },
    );

    expect(response.status).toBe(403);
    expect(outbound).not.toHaveBeenCalled();
  });
});

describe("GET /api/music", () => {
  it("returns a nine-album weekly chart", async () => {
    const outbound = vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
      const outgoing = new Request(input, init);
      const url = new URL(outgoing.url);
      const method = url.searchParams.get("method");

      if (method === "user.getrecenttracks") {
        return Response.json({
          recenttracks: {
            track: [{
              name: "Current track",
              artist: { "#text": "Current artist" },
              album: { "#text": "Current album" },
              url: "https://last.fm/current",
              image: [],
              "@attr": { nowplaying: "true" },
            }],
          },
        });
      }
      if (method === "track.getInfo") return Response.json({ track: { userplaycount: "12" } });
      if (method === "user.gettopalbums") {
        const count = url.searchParams.get("period") === "7day" ? 9 : 100;
        return Response.json({
          topalbums: {
            album: Array.from({ length: count }, (_, index) => ({
              name: `Album ${index + 1}`,
              artist: { name: `Artist ${index + 1}` },
              url: `https://last.fm/album/${index + 1}`,
              image: [{ size: "extralarge", "#text": `https://images.example/${index + 1}.jpg` }],
              playcount: String(100 - index),
            })),
          },
        });
      }
      throw new Error(`Unexpected request: ${outgoing.method} ${outgoing.url}`);
    });

    const response = await exports.default.fetch("http://localhost/api/music?weekly-chart-test");
    const body = await response.json() as { weeklyAlbums: unknown[]; topAlbums: unknown[] };

    expect(response.status).toBe(200);
    expect(body.weeklyAlbums).toHaveLength(9);
    expect(body.topAlbums).toHaveLength(100);
    const requests = outbound.mock.calls.map(([input, init]) => new URL(new Request(input, init).url));
    expect(requests.some((url) => url.searchParams.get("period") === "7day" && url.searchParams.get("limit") === "9")).toBe(true);

    const currentResponse = await exports.default.fetch("http://localhost/api/current?poll-test");
    const currentBody = await currentResponse.json() as { current: { name: string; nowPlaying: boolean } };
    expect(currentResponse.status).toBe(200);
    expect(currentResponse.headers.get("cache-control")).toBe("no-store");
    expect(currentBody.current).toMatchObject({ name: "Current track", nowPlaying: true });
  });
});

describe("POST /api/recommend", () => {
  it("validates Turnstile and forwards one safe Discord message", async () => {
    const outbound = vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
      const outgoing = new Request(input, init);
      if (outgoing.url === "https://challenges.cloudflare.com/turnstile/v0/siteverify") return successfulTurnstile();
      if (outgoing.url === env.DISCORD_WEBHOOK_URL) return new Response(null, { status: 204 });
      throw new Error(`Unexpected request: ${outgoing.method} ${outgoing.url}`);
    });

    const response = await send({ recommendation: "Talk Talk, Spirit of Eden", turnstileToken: "XXXX.DUMMY.TOKEN.XXXX" });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ ok: true });
    expect(outbound).toHaveBeenCalledTimes(2);

    const discordRequest = new Request(outbound.mock.calls[1]?.[0] as RequestInfo, outbound.mock.calls[1]?.[1]);
    await expect(discordRequest.json()).resolves.toEqual({
      content: "Talk Talk, Spirit of Eden",
      username: "alex is listening to",
      allowed_mentions: { parse: [] },
    });
  });

  it("rejects oversized recommendations before external calls", async () => {
    const outbound = vi.spyOn(globalThis, "fetch");
    const response = await send({ recommendation: "x".repeat(281), turnstileToken: "token" });

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "keep it between 1 and 280 characters" });
    expect(outbound).not.toHaveBeenCalled();
  });

  it("does not retry an ambiguous Discord failure", async () => {
    const outbound = vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
      const outgoing = new Request(input, init);
      if (outgoing.url === "https://challenges.cloudflare.com/turnstile/v0/siteverify") return successfulTurnstile();
      if (outgoing.url === env.DISCORD_WEBHOOK_URL) throw new Error("connection reset");
      throw new Error(`Unexpected request: ${outgoing.method} ${outgoing.url}`);
    });

    const response = await send({ recommendation: "Roxy Music, Avalon", turnstileToken: "XXXX.DUMMY.TOKEN.XXXX" });

    expect(response.status).toBe(502);
    await expect(response.json()).resolves.toEqual({ error: "discord didn't confirm that. don't resend it yet." });
    expect(outbound).toHaveBeenCalledTimes(2);
  });
});
