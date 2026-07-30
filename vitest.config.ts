import { cloudflareTest } from "@cloudflare/vitest-pool-workers";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [
    cloudflareTest({
      wrangler: { configPath: "./wrangler.jsonc" },
      miniflare: {
        bindings: {
          LASTFM_API_KEY: "test-lastfm-key",
          DISCORD_WEBHOOK_URL: "https://discord.com/api/webhooks/123/test-token",
          TURNSTILE_SECRET: "test-turnstile-secret",
          TURNSTILE_SITE_KEY: "1x00000000000000000000AA",
          TURNSTILE_HOSTNAMES: "localhost,127.0.0.1",
          ALLOWED_ORIGINS: "http://localhost,https://alexislisteningto.github.io",
        },
      },
    }),
  ],
});
