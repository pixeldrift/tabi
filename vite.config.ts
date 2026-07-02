import { defineConfig } from "vite";
import viteReact from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import tsConfigPaths from "vite-tsconfig-paths";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import { nitro } from "nitro/vite";

// Deploy target is a one-line swap — Nitro ships presets for every major
// host (cloudflare, vercel, netlify, node-server for self-hosting, ...).
// Override at build time with `NITRO_PRESET=cloudflare-module vite build`
// without touching this file, or just change the default below.
//
// Notes on presets we've actually deployed with:
// - `vercel`: outputs to `.vercel/output` (Vercel's Build Output API) —
//   leave Nitro's default output dir alone, Vercel looks for that path
//   specifically.
// - `cloudflare-module`: Cloudflare's "Connect to Git" flow now provisions
//   projects on its unified Workers platform, whose fixed deploy step is
//   `wrangler deploy` (not `wrangler pages deploy`) — so this targets the
//   plain-Worker preset (Worker + static-assets binding), pinned to `dist`
//   to match a "Build output directory: dist" dashboard setting. The
//   legacy `cloudflare-pages` preset fails on that flow.
const preset = process.env.NITRO_PRESET ?? "vercel";

export default defineConfig({
  resolve: {
    // Avoid duplicate React/TanStack copies when multiple deps resolve
    // their own instances.
    dedupe: ["react", "react-dom", "@tanstack/react-router", "@tanstack/react-start"],
  },
  plugins: [
    tsConfigPaths(),
    tailwindcss(),
    tanstackStart({
      // Redirect TanStack Start's bundled server entry to src/server.ts
      // (our SSR error wrapper).
      server: { entry: "server" },
    }),
    nitro({
      preset,
      ...(preset.startsWith("cloudflare") ? { output: { dir: "dist" } } : {}),
    }),
    viteReact(),
  ],
});
