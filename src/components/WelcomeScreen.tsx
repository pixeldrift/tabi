import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { ArrowRight } from "lucide-react";
import tabiLogo from "@/assets/images/tabi-logo.png";

/** The app's opening splash — logo, one-line pitch, and the single "Get
 *  Started" action that hands off to the main interface (see routes/index.tsx's
 *  screen-slide wiring). Version/build info and the credit line live here
 *  now instead of in StatusBar's title row, since they're app-identity
 *  info a technician only cares about once, not something worth permanent
 *  header real estate on every tab. */
export function WelcomeScreen({ onGetStarted }: { onGetStarted: () => void }) {
  const [showCommitSha, setShowCommitSha] = useState(false);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-8 bg-background px-6 py-12 text-center">
      <div className="flex flex-col items-center gap-2">
        <img src={tabiLogo} alt="Tabi" className="w-40 sm:w-48" />
        <p className="text-sm font-semibold tracking-wide text-foreground/70 sm:text-base">
          Better data. Better sessions.
        </p>
      </div>

      <div className="max-w-xs space-y-3 text-left text-sm leading-relaxed text-muted-foreground sm:max-w-sm sm:text-base">
        <p>
          Tabi is your friendly companion app for ABA therapy, data collection, and session
          management. This prototype is a proof of concept for a front-end experience designed with
          RBTs in mind.
        </p>
        <p>
          Our goal is to make Tabi easy, intuitive, and fast. The tools you need are right where you
          need them, when you need them.
        </p>
        <p>Have a suggestion? We&rsquo;d love your feedback!</p>
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
          Nathan D. B. Pizar
        </a>
      </div>
    </div>
  );
}
