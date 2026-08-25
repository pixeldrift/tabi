import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { ArrowRight, Compass, Lightbulb } from "lucide-react";
import tabiLogo from "@/assets/images/tabi-logo.png";

/** The app's opening splash screen with logo, tagline, and the single "Get
 *  Started" action that hands off to the main interface (see routes/index.tsx's
 *  screen-slide wiring). Version/build info and the credit line live here
 *  now instead of in StatusBar's title row, since they're app-identity
 *  info a technician only cares about once, not something worth permanent
 *  header real estate on every tab. */
export function WelcomeScreen({
  onGetStarted,
  onLaunchTour,
  onLaunchTip,
}: {
  onGetStarted: () => void;
  /** Same hand-off as onGetStarted, but also force-starts the guided tour
   *  once main settles — regardless of tourHintsEnabled/tourCompleted, see
   *  TourContext's own comment. A manual escape hatch for testing/demos
   *  rather than something a real first-time user needs — Get Started
   *  already auto-launches the tour on its own. */
  onLaunchTour: () => void;
  /** Same idea as onLaunchTour, but for the "Did you know?" tip rotation —
   *  force-shows a tip once main settles regardless of tipsEnabled, see
   *  TipContext's own comment. */
  onLaunchTip: () => void;
}) {
  const [showCommitSha, setShowCommitSha] = useState(false);

  return (
    <div className="flex h-full min-h-screen flex-col items-center justify-center gap-8 overflow-y-auto bg-background px-6 py-12 text-center">
      <div className="flex flex-col items-center gap-2">
        <img src={tabiLogo} alt="Tabi" className="w-40 sm:w-48" />
        <p className="text-base font-semibold tracking-wide text-foreground/70 sm:text-lg">
          Better data. Better sessions.
        </p>
      </div>

      <div className="max-w-xs space-y-3 text-left text-sm leading-relaxed text-muted-foreground sm:max-w-sm sm:text-base">
        <p>
          Tabi is your friendly companion for ABA therapy, data collection, and session management.
          This prototype app is a proof of concept for a front-end experience designed with RBTs in
          mind.
        </p>
        <p>
          Our goal is to make Tabi easy, intuitive, and fast. The tools you need are right where you
          need them, when you need them.
        </p>
      </div>

      {/* blue-700/800 (this app's "Slate" pine-teal reskin of Tailwind's
          blue-*, not its literal blue) — the closest palette shade to the
          logo's own dark teal, sampled at oklch(40% 0.065 193) vs. the
          logo's dominant rgb(0,77,77). green-500/600 (this app's Sage) is
          a genuinely different hue and read as mismatched next to the
          logo, even though it's the same shade "Start New Session" uses
          for its own, unrelated (go/start) meaning. */}
      <button
        type="button"
        onClick={onGetStarted}
        className="btn-bevel flex items-center gap-2 rounded-full bg-blue-700 px-8 py-3.5 text-base font-semibold text-white transition-colors hover:bg-blue-800 active:scale-95"
      >
        Get Started
        <ArrowRight className="size-5" />
      </button>

      {/* Small and secondary on purpose — this bypasses the real "does the
          tour show up on its own" behavior Get Started exercises, so it's a
          manual escape hatch for testing/demos, not the first-time flow.
          Own flex column (not two more gap-8 siblings) so they sit flush
          against each other instead of inheriting the same big gap every
          other row in this stack uses. */}
      <div className="-mt-4 flex flex-col items-center">
        <button
          type="button"
          onClick={onLaunchTour}
          className="flex items-center gap-1.5 py-1 text-xs text-stone-400 transition-colors hover:text-stone-600"
        >
          <Compass className="size-3.5" />
          Preview guided tour
        </button>
        <button
          type="button"
          onClick={onLaunchTip}
          className="flex items-center gap-1.5 py-1 text-xs text-stone-400 transition-colors hover:text-stone-600"
        >
          <Lightbulb className="size-3.5" />
          Preview a tip
        </button>
      </div>

      <div className="mt-4 flex flex-col items-center gap-1.5">
        <button
          type="button"
          onClick={() => setShowCommitSha((v) => !v)}
          title={showCommitSha ? "Tap to show version" : "Tap to show commit SHA"}
          className="italic text-xs text-stone-400 overflow-hidden"
        >
          <AnimatePresence mode="popLayout" initial={false}>
            <motion.span
              key={showCommitSha ? "sha" : "version"}
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 4 }}
              transition={{ duration: 0.15 }}
              className="inline-block"
            >
              ({showCommitSha ? __APP_COMMIT_SHA__ : __APP_VERSION__})
            </motion.span>
          </AnimatePresence>
        </button>
        <a
          href="mailto:nathan@pizar.net"
          className="text-xs italic font-light text-stone-400 transition-colors hover:text-stone-500"
        >
          &copy; 2026 - Nathan D. B. Pizar
        </a>
      </div>
    </div>
  );
}
