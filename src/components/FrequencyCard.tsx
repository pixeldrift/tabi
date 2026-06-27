import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Minus, Plus } from "lucide-react";
import { CardShell } from "./CardShell";
import { NumberKeypad } from "./NumberKeypad";
import { useSession } from "./SessionContext";
import { cn } from "@/lib/utils";

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
  const [dir, setDir] = useState<1 | -1>(1);
  const [flash, setFlash] = useState(false);
  const [editing, setEditing] = useState(false);
  const { markDirty } = useSession();

  const isComplete = count >= minCount;
  const remaining = Math.max(0, minCount - count);

  const triggerFlash = () => {
    setFlash(true);
    window.setTimeout(() => setFlash(false), 450);
  };

  const inc = () => {
    setDir(1);
    setCount((c) => c + 1);
    setBumpKey((k) => k + 1);
    triggerFlash();
    markDirty();
  };
  const dec = () => {
    setDir(-1);
    setCount((c) => Math.max(0, c - 1));
    setBumpKey((k) => k + 1);
    triggerFlash();
    markDirty();
  };


  const commit = (next: number) => {
    setDir(next >= count ? 1 : -1);
    setCount(next);
    setBumpKey((k) => k + 1);
    triggerFlash();
    markDirty();
  };


  return (
    <CardShell
      title={title}
      phase={phase}
      dataType="Frequency"
      description={description}
      isActive={isActive}
      onActivate={onActivate}
      progress={null}
      editing={editing}
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
          className="size-12 shrink-0 aspect-square rounded-full grid place-items-center border border-stone-200 bg-white text-foreground/70 hover:bg-stone-50 active:scale-95 transition disabled:opacity-30"
        >
          <Minus className="size-5" strokeWidth={2.5} />
        </button>

        <NumberKeypad
          value={count}
          onReplace={(v) => commit(v)}
          onAdd={(delta) => commit(count + delta)}
          onOpenChange={setEditing}
        >
          {({ isEditing, open }) => (
              <button
              type="button"
              onClick={open}
              className="flex flex-col items-center justify-center min-w-[6rem] cursor-text rounded-lg px-3 py-1 transition-colors"
              aria-label={`Current count is ${count}. Tap to edit.`}
            >
              <div className="relative overflow-hidden rounded-lg px-2 py-0.5">
                <AnimatePresence mode="popLayout" initial={false}>
                  <motion.span
                    key={bumpKey}
                    initial={{ y: dir > 0 ? "100%" : "-100%", opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    exit={{ y: dir > 0 ? "-100%" : "100%", opacity: 0 }}
                    transition={{ type: "spring", stiffness: 520, damping: 24, mass: 0.7 }}
                    className={cn(
                      "block font-display text-5xl leading-none tabular-nums transition-colors",
                      isEditing ? "text-blue-600" : "text-foreground",
                      flash && "text-blue-600",
                    )}
                  >
                    {count}
                  </motion.span>
                </AnimatePresence>
                {isEditing && (
                  <span className="pointer-events-none absolute inset-0 rounded-lg border-2 border-blue-400/80" aria-hidden />
                )}
              </div>
              <span
                className={cn(
                  "mt-1 text-[11px] uppercase tracking-wider transition-colors",
                  isEditing ? "text-blue-500" : "text-muted-foreground",
                )}
              >
                {count === 1 ? "Time" : "Times"}
              </span>
            </button>
          )}
        </NumberKeypad>

        <motion.button
          onClick={inc}
          whileTap={{ scale: 0.94 }}
          aria-label="Increment"
          className={cn(
            "size-16 shrink-0 aspect-square rounded-full grid place-items-center text-white shadow-[0_4px_12px_rgba(59,130,246,0.35)] transition-colors",
            "bg-blue-500 hover:bg-blue-600 active:bg-blue-700",
          )}
        >
          <Plus className="size-7" strokeWidth={3} />
        </motion.button>
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
