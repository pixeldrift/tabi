import { execSync } from "node:child_process";
import { defineConfig } from "vite";
import viteReact from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import tsConfigPaths from "vite-tsconfig-paths";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import { nitro } from "nitro/vite";
import svgr from "vite-plugin-svgr";

// Current PR number, prefixed onto the version string below — update (or
// clear) this alongside whichever PR is currently open, since there's no
// git-only way to derive it at build time.
const CURRENT_PR = "68";

// Short git commit hash, baked in at build time — shown in the header next
// to the data sheet title so it's obvious at a glance whether a given
// screen is running the latest build, with zero manual version bumping to
// remember. Falls back to "dev" wherever git isn't available (e.g. an
// archive/tarball build).
function getAppVersion(): string {
  let sha: string;
  try {
    sha = execSync("git rev-parse --short HEAD", { stdio: ["ignore", "pipe", "ignore"] }).toString().trim();
  } catch {
    sha = "dev";
  }
  return CURRENT_PR ? `PR${CURRENT_PR} - ${sha}` : sha;
}

export default defineConfig({
  define: {
    __APP_VERSION__: JSON.stringify(getAppVersion()),
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
