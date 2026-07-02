import { type ReactNode } from "react";
import { motion } from "motion/react";
import { Sparkles } from "lucide-react";
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
  /** Small outline icon shown to the left of the dataType label. */
  dataTypeIcon?: ReactNode;
  description?: string;
  isActive?: boolean;
  onActivate?: () => void;
  /** 0–100 progress. Pass null/undefined to hide the progress bar entirely. */
  progress?: number | null;
  isComplete?: boolean;
  helperText?: ReactNode;
  details?: ReactNode;
  editing?: boolean;
  children: ReactNode;
}

export function CardShell({
  title,
  phase = "Intervention",
  dataType,
  dataTypeIcon,
  description,
  isActive = true,
  onActivate,
  progress,
  isComplete = false,
  helperText,
  details,
  editing = false,
  children,
}: CardShellProps) {
  const showProgress = typeof progress === "number";
  const pct = showProgress ? Math.min(100, Math.max(0, progress!)) : 0;
  const barBg = isComplete
    ? "bg-green-500/30"
    : pct >= 50
      ? "bg-yellow-400/30"
      : "bg-blue-400/30";

  return (
    <article
      onClick={onActivate}
      className={cn(
        "relative w-full max-w-md rounded-xl overflow-hidden bg-card text-card-foreground border-2 transition-all duration-200",
        isActive
          ? editing
            ? "border-stone-200 shadow-[0_10px_30px_-4px_rgba(0,0,0,0.25)]"
            : "border-blue-400/80 shadow-[0_10px_30px_-4px_rgba(0,0,0,0.25)]"
          : "border-stone-200 opacity-80 hover:opacity-95",
      )}
    >
      <header className="flex items-start gap-3 pl-5 pr-3 pt-3 pb-0">
        <h2 className="font-display text-lg leading-tight flex-1 mr-auto">{title}</h2>
        <div className="flex items-start gap-2">
          <div className="text-right leading-tight">
            <div className="text-xs font-medium text-blue-400">{phase}</div>
            {dataType && (
              <div className="flex items-center justify-end gap-1 text-[11px] text-muted-foreground">
                {dataTypeIcon && (
                  <span className="shrink-0 [&>svg]:size-3">{dataTypeIcon}</span>
                )}
                <span>{dataType}</span>
              </div>
            )}
          </div>
          <Sheet>
            <SheetTrigger asChild>
              <button
                aria-label="Card details"
                className="rounded-full p-2 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              >
                <span
                  className="grid size-6 place-items-center rounded-full border-2 border-current font-serif italic text-[13px] leading-none"
                  aria-hidden
                >
                  i
                </span>
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
          <div className="relative h-5">
            <div className="absolute inset-0 bg-stone-200">
              <motion.div
                className={cn("absolute inset-y-0 left-0", barBg)}
                animate={{ width: `${pct}%` }}
                transition={{ type: "spring", stiffness: 180, damping: 26 }}
              />
            </div>
            <div className="absolute inset-0 flex items-center justify-center px-5 text-[11px] text-foreground/75 leading-none pointer-events-none">
              {helperText}
            </div>
          </div>
          {isComplete && (
            <div className="absolute inset-0 grid place-items-center pointer-events-none">
              <Starburst />
            </div>
          )}
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
