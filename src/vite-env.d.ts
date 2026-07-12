/// <reference types="vite/client" />
/// <reference types="vite-plugin-svgr/client" />

/** Git commit count ("v143"), injected by vite.config.ts's `define` — see
 *  its own comment for why. */
declare const __APP_VERSION__: string;
/** Short git commit SHA, injected alongside __APP_VERSION__ — the
 *  tap-to-reveal detail behind it in StatusBar. */
declare const __APP_COMMIT_SHA__: string;
