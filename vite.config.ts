import { execSync } from "node:child_process";
import { defineConfig } from "vite";
import viteReact from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import tsConfigPaths from "vite-tsconfig-paths";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import { nitro } from "nitro/vite";
import svgr from "vite-plugin-svgr";

// Shown in the header next to the data sheet title — the repo's total
// commit count, so it climbs on its own with every push instead of needing
// a manual bump per release. Falls back to "dev" wherever git isn't
// available (e.g. an archive/tarball build). The short SHA is exact-build
// detail a glance at the count doesn't give you — tucked behind a tap in
// the UI (see StatusBar) rather than shown by default.
function gitOutput(command: string, fallback: string): string {
  try {
    return execSync(command, { stdio: ["ignore", "pipe", "ignore"] }).toString().trim();
  } catch {
    return fallback;
  }
}
const APP_VERSION = `v${gitOutput("git rev-list --count HEAD", "0")}`;
const APP_COMMIT_SHA = gitOutput("git rev-parse --short HEAD", "dev");

export default defineConfig({
  define: {
    __APP_VERSION__: JSON.stringify(APP_VERSION),
    __APP_COMMIT_SHA__: JSON.stringify(APP_COMMIT_SHA),
  },
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
    // Deployed on Vercel — Nitro's `vercel` preset outputs to
    // `.vercel/output` (Vercel's Build Output API), so its default output
    // dir is left alone.
    nitro({ preset: "vercel" }),
    viteReact(),
    // Custom icons live as real, standalone .svg files (src/components/icons/svg/**)
    // so they stay directly editable in tools like Illustrator — this turns
    // an `import Icon from "./foo.svg?react"` into a React component that
    // still forwards props (className, strokeWidth, ...) the same way the
    // old hand-written JSX icon components did.
    svgr(),
  ],
});
