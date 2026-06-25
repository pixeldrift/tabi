import { useState, useCallback, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Minus, Plus, Delete, Check } from "lucide-react";
import { CardShell } from "./CardShell";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import { VisuallyHidden } from "@radix-ui/react-visually-hidden";

export interface FrequencyCardProps {
  title: string;
  phase?: string;
  description?: string;
  minCount?: number;
  isActive?: boolean;
  onActivate?: () => void;
}

export function FrequencyCard({
  title,
  phase = "Intervention",
  description,
  minCount = 5,
  isActive = true,
  onActivate,
}: FrequencyCardProps) {
  const [count, setCount] = useState(0);
  const [bumpKey, setBumpKey] = useState(0);

  const progress = Math.min(100, Math.round((count / Math.max(minCount, 1)) * 100));
  const isComplete = count >= minCount;
  const remaining = Math.max(0, minCount - count);

  const inc = () => {
    setCount((c) => c + 1);
    setBumpKey((k) => k + 1);
  };
  const dec = () => setCount((c) => Math.max(0, c - 1));
  const reset = () => setCount(0);

  return (
    <CardShell
      title={title}
      phase={phase}
      dataType="Frequency"
      description={description}
      isActive={isActive}
      onActivate={onActivate}
      progress={null}
      isComplete={isComplete}
      helperText={
        isComplete ? (
          "Minimum count reached. This data can now be graphed."
        ) : (
          <span>
            Record at least <strong className="font-semibold">{remaining} more</strong>{" "}
            {remaining === 1 ? "occurrence" : "occurrences"}.
          </span>
        )
      }
      details={
        <dl className="space-y-3">
          <Row label="Phase" value={phase} />
          <Row label="Data type" value="Frequency (count)" />
          <Row label="Minimum count" value={String(minCount)} />
          <Row label="Recorded so far" value={String(count)} />
        </dl>
      }
    >
      <div className="px-5 pt-2 pb-4 flex items-center justify-between gap-3">
        <button
          onClick={dec}
          disabled={count === 0}
          aria-label="Decrement"
          className="size-12 rounded-full grid place-items-center border border-stone-200 bg-white text-foreground/70 hover:bg-stone-50 active:scale-95 transition disabled:opacity-30"
        >
          <Minus className="size-5" strokeWidth={2.5} />
        </button>

        <div className="flex flex-col items-center justify-center min-w-[6rem]">
          <AnimatePresence mode="popLayout" initial={false}>
            <motion.span
              key={bumpKey}
              initial={{ scale: 0.7, opacity: 0, y: 8 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ type: "spring", stiffness: 360, damping: 22 }}
              className="font-display text-5xl leading-none tabular-nums"
            >
              {count}
            </motion.span>
          </AnimatePresence>
          <span className="mt-1 text-[11px] uppercase tracking-wider text-muted-foreground">
            occurrences
          </span>
        </div>

        <motion.button
          onClick={inc}
          whileTap={{ scale: 0.94 }}
          aria-label="Increment"
          className={cn(
            "size-16 rounded-full grid place-items-center text-white shadow-[0_4px_12px_rgba(59,130,246,0.35)] transition-colors",
            "bg-blue-500 hover:bg-blue-600 active:bg-blue-700",
          )}
        >
          <Plus className="size-7" strokeWidth={3} />
        </motion.button>
      </div>

      <div className="px-5 pb-3 flex justify-center">
        <button
          onClick={reset}
          disabled={count === 0}
          className="flex items-center gap-1.5 text-[11px] text-muted-foreground hover:text-foreground disabled:opacity-30 transition-colors"
        >
          <RotateCcw className="size-3" /> Reset
        </button>
      </div>
    </CardShell>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="font-medium">{value}</dd>
    </div>
  );
}
