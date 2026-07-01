import { defineConfig } from "vite";
import viteReact from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import tsConfigPaths from "vite-tsconfig-paths";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import { nitro } from "nitro/vite";

// Deploy target is a one-line swap — Nitro ships presets for every major
// host (cloudflare, vercel, netlify, node-server for self-hosting, ...).
// Override at build time with `NITRO_PRESET=vercel vite build` without
// touching this file, or just change the default below.
const preset = process.env.NITRO_PRESET ?? "cloudflare-pages";

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
    nitro({ preset }),
    viteReact(),
  ],
});
