import { type ReactNode } from "react";
import { motion } from "motion/react";
import { Check, Info, Sparkles } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

export interface CardShellProps {
  title: string;
  phase?: string;
  dataType?: string;
  description?: string;
  isActive?: boolean;
  onActivate?: () => void;
  /** 0–100 progress. Pass null/undefined to hide the progress bar entirely. */
  progress?: number | null;
  isComplete?: boolean;
  helperText?: ReactNode;
  details?: ReactNode;
  children: ReactNode;
}

export function CardShell({
  title,
  phase = "Intervention",
  dataType,
  description,
  isActive = true,
  onActivate,
  progress,
  isComplete = false,
  helperText,
  details,
  children,
}: CardShellProps) {
  const showProgress = typeof progress === "number";
  const pct = showProgress ? Math.min(100, Math.max(0, progress!)) : 0;

  return (
    <article
      onClick={onActivate}
      className={cn(
        "relative w-full max-w-md rounded-xl bg-card text-card-foreground transition-all duration-200",
        isActive
          ? "border-2 border-blue-400/80 shadow-[0_10px_30px_-4px_rgba(0,0,0,0.25)]"
          : "border border-stone-200 opacity-80 hover:opacity-95",
      )}
    >
      <header className="flex items-start gap-3 pl-5 pr-3 pt-3 pb-0">
        <h2 className="font-display text-xl leading-tight flex-1 mr-auto">{title}</h2>
        <div className="flex items-start gap-2">
          <div className="text-right leading-tight">
            <div className="text-xs font-medium text-blue-400">{phase}</div>
            {dataType && (
              <div className="text-[11px] text-muted-foreground">{dataType}</div>
            )}
          </div>
          <Sheet>
            <SheetTrigger asChild>
              <button
                aria-label="Card details"
                className="rounded-full p-2 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              >
                <Info className="size-6" />
              </button>
            </SheetTrigger>
            <SheetContent side="right" className="w-[88%] sm:max-w-md">
              <SheetHeader>
                <SheetTitle className="font-display">{title}</SheetTitle>
                {description && <SheetDescription>{description}</SheetDescription>}
              </SheetHeader>
              {details && <div className="mt-6 px-4 text-sm">{details}</div>}
            </SheetContent>
          </Sheet>
        </div>
      </header>

      {children}

      {showProgress && (
        <div className="relative mt-3">
          <div className="relative h-5 overflow-hidden rounded-b-xl">
            <div className="absolute inset-0 bg-muted">
              <motion.div
                className={cn(
                  "absolute inset-y-0 left-0",
                  isComplete ? "bg-green-500/25" : "bg-blue-400/25",
                )}
                animate={{ width: `${pct}%` }}
                transition={{ type: "spring", stiffness: 180, damping: 26 }}
              />
            </div>
            <div className="absolute inset-0 flex items-center justify-center px-5 text-[11px] text-foreground/75 leading-none pointer-events-none">
              {helperText}
            </div>
          </div>

          <motion.div
            className="absolute bottom-0 left-0 z-30 pointer-events-none"
            animate={{ left: `${pct}%` }}
            transition={{ type: "spring", stiffness: 180, damping: 26 }}
            style={{ translateX: "-50%" }}
          >
            <motion.div
              animate={isComplete ? { scale: [1, 1.25, 1] } : { scale: 1 }}
              transition={{ duration: 0.7 }}
              className="relative flex flex-col items-center"
            >
              <div
                className={cn(
                  "grid place-items-center h-[18px] min-w-[30px] px-1.5 rounded-md text-[10px] font-semibold leading-none text-white shadow-[0_2px_6px_rgba(0,0,0,0.18)]",
                  isComplete ? "bg-green-500" : "bg-blue-500",
                )}
              >
                {isComplete ? <Check className="size-3" strokeWidth={3} /> : `${Math.round(pct)}%`}
              </div>
              <div
                className={cn(
                  "w-0 h-0 border-l-[4px] border-r-[4px] border-t-[5px] border-l-transparent border-r-transparent",
                  isComplete ? "border-t-green-500" : "border-t-blue-500",
                )}
                aria-hidden
              />
              {isComplete && <Starburst />}
            </motion.div>
          </motion.div>
        </div>
      )}
    </article>
  );
}

function Starburst() {
  const rays = Array.from({ length: 8 });
  return (
    <span className="absolute inset-0 pointer-events-none">
      {rays.map((_, i) => {
        const angle = (i / rays.length) * Math.PI * 2;
        const x = Math.cos(angle) * 22;
        const y = Math.sin(angle) * 22;
        return (
          <motion.span
            key={i}
            initial={{ x: 0, y: 0, opacity: 1, scale: 0.4 }}
            animate={{ x, y, opacity: 0, scale: 1 }}
            transition={{ duration: 0.9, delay: 0.1, ease: "easeOut" }}
            className="absolute top-1/2 left-1/2 -ml-1 -mt-1 size-2 rounded-full bg-yellow-300"
          />
        );
      })}
      <motion.span
        initial={{ scale: 0, opacity: 0.8 }}
        animate={{ scale: 1.6, opacity: 0 }}
        transition={{ duration: 0.7 }}
        className="absolute inset-0 grid place-items-center text-yellow-400"
      >
        <Sparkles className="size-6" />
      </motion.span>
    </span>
  );
}
