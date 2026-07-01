import { useEffect, useState } from "react";
import { motion } from "motion/react";
import { Check, HandHelping, X } from "lucide-react";
import { CardShell } from "./CardShell";
import { TaskAnalysisIcon } from "./icons/DataTypeIcons";
import { useSession } from "./SessionContext";
import { cn } from "@/lib/utils";

export type StepStatus = "independent" | "prompted" | "error" | null;

export interface TaskAnalysisCardProps {
  title: string;
  phase?: string;
  description?: string;
  steps: string[];
  isActive?: boolean;
  onActivate?: () => void;
}

const OPTIONS: { value: Exclude<StepStatus, null>; label: string; icon: typeof Check; classes: string; selectedClasses: string }[] = [
  {
    value: "independent",
    label: "I",
    icon: Check,
    classes: "border-green-300 text-green-700 hover:bg-green-50",
    selectedClasses: "bg-green-400 border-green-500 text-white",
  },
  {
    value: "prompted",
    label: "P",
    icon: HandHelping,
    classes: "border-amber-300 text-amber-700 hover:bg-amber-50",
    selectedClasses: "bg-amber-400 border-amber-500 text-white",
  },
  {
    value: "error",
    label: "E",
    icon: X,
    classes: "border-red-300 text-red-700 hover:bg-red-50",
    selectedClasses: "bg-red-400 border-red-500 text-white",
  },
];

export function TaskAnalysisCard({
  title,
  phase = "Intervention",
  description,
  steps,
  isActive = true,
  onActivate,
}: TaskAnalysisCardProps) {
  const [statuses, setStatuses] = useState<StepStatus[]>(() => steps.map(() => null));
  const { markDirty, resetSignal } = useSession();

  useEffect(() => {
    if (resetSignal === 0) return;
    setStatuses(steps.map(() => null));
  }, [resetSignal, steps]);

  const setStep = (idx: number, value: Exclude<StepStatus, null>) => {
    markDirty();
    setStatuses((prev) => {
      const next = [...prev];
      next[idx] = next[idx] === value ? null : value;
      return next;
    });
  };

  const completed = statuses.filter((s) => s !== null).length;
  const independent = statuses.filter((s) => s === "independent").length;
  const progress = steps.length > 0 ? Math.round((completed / steps.length) * 100) : 0;
  const isComplete = completed >= steps.length;
  const remaining = Math.max(0, steps.length - completed);

  return (
    <CardShell
      title={title}
      phase={phase}
      dataType="Task Analysis"
      dataTypeIcon={<TaskAnalysisIcon />}
      description={description}
      isActive={isActive}
      onActivate={onActivate}
      progress={progress}
      isComplete={isComplete}
      helperText={
        isComplete ? (
          <span>
            All steps scored ·{" "}
            <strong className="font-semibold">
              {independent}/{steps.length} independent
            </strong>
          </span>
        ) : (
          <span>
            Score <strong className="font-semibold">{remaining} more</strong>{" "}
            {remaining === 1 ? "step" : "steps"}.
          </span>
        )
      }
      details={
        <dl className="space-y-3">
          <Row label="Phase" value={phase} />
          <Row label="Data type" value="Task analysis (I / P / E)" />
          <Row label="Steps" value={String(steps.length)} />
          <Row label="Scored" value={`${completed} / ${steps.length}`} />
          <Row label="Independent" value={`${independent} / ${steps.length}`} />
        </dl>
      }
    >
      <ol className="px-3 pt-1 pb-3 space-y-1">
        {steps.map((step, i) => (
          <li
            key={i}
            className="flex items-center gap-2 rounded-lg px-2 py-1.5"
          >
            <span className="grid place-items-center size-6 rounded-full bg-stone-100 text-[11px] font-medium text-foreground/60 shrink-0">
              {i + 1}
            </span>
            <span
              className={cn(
                "flex-1 text-sm leading-tight",
                statuses[i] && "text-foreground/80",
              )}
            >
              {step}
            </span>
            <div className="flex items-center gap-1 shrink-0">
              {OPTIONS.map((opt) => {
                const Icon = opt.icon;
                const selected = statuses[i] === opt.value;
                return (
                  <motion.button
                    key={opt.value}
                    onClick={() => setStep(i, opt.value)}
                    whileTap={{ scale: 0.9 }}
                    aria-label={opt.value}
                    className={cn(
                      "size-8 rounded-md border-2 grid place-items-center transition-colors",
                      opt.classes,
                      selected && opt.selectedClasses,
                    )}
                  >
                    <Icon className="size-3.5" strokeWidth={3} />
                  </motion.button>
                );
              })}
            </div>
          </li>
        ))}
      </ol>
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
