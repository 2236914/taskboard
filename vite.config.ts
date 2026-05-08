// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - tanstackStart, viteReact, tailwindcss, tsConfigPaths, cloudflare (build-only),
//     componentTagger (dev-only), VITE_* env injection, @ path alias, React/TanStack dedupe,
//     error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... } }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

// Build target is selected via the BUILD_TARGET env var so the same repo
// can ship to multiple platforms without code changes:
//   BUILD_TARGET=vercel       → Vercel (set this in the Vercel project env)
//   BUILD_TARGET=cloudflare   → Cloudflare Workers (default)
//   BUILD_TARGET=node-server  → standalone Node server
const target = process.env.BUILD_TARGET ?? "cloudflare";
const isVercel = target === "vercel";

export default defineConfig({
  // Disable the Cloudflare plugin when building for any non-Cloudflare target,
  // otherwise the build emits a Workers bundle that Vercel/Node can't run.
  cloudflare: isVercel ? false : undefined,
  tanstackStart: isVercel ? { target: "vercel" } : undefined,
});
