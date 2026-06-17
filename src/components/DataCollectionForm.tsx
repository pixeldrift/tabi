import { useState, useMemo } from "react";
import { motion, AnimatePresence, type Variants } from "motion/react";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Sparkles,
  User,
  Briefcase,
  Target,
  Mail,
  Loader2,
  Building2,
  Rocket,
  Palette,
  Code2,
  LineChart,
  Heart,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

type FormData = {
  name: string;
  email: string;
  role: string;
  company: string;
  goals: string[];
  budget: number;
  notes: string;
};

const ROLES = [
  { id: "founder", label: "Founder", icon: Rocket },
  { id: "designer", label: "Designer", icon: Palette },
  { id: "engineer", label: "Engineer", icon: Code2 },
  { id: "marketer", label: "Marketer", icon: LineChart },
];

const GOALS = [
  { id: "launch", label: "Launch a product" },
  { id: "grow", label: "Grow an audience" },
  { id: "automate", label: "Automate workflows" },
  { id: "research", label: "Research the market" },
  { id: "hire", label: "Build a team" },
  { id: "fundraise", label: "Raise funding" },
];

const stepVariants: Variants = {
  enter: { opacity: 0, y: 16, filter: "blur(6px)" },
  center: { opacity: 1, y: 0, filter: "blur(0px)" },
  exit: { opacity: 0, y: -16, filter: "blur(6px)" },
};

const STEPS = ["You", "Work", "Goals", "Details", "Done"] as const;

export function DataCollectionForm() {
  const [step, setStep] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [data, setData] = useState<FormData>({
    name: "",
    email: "",
    role: "",
    company: "",
    goals: [],
    budget: 5,
    notes: "",
  });

  const update = <K extends keyof FormData>(key: K, value: FormData[K]) =>
    setData((d) => ({ ...d, [key]: value }));

  const toggleGoal = (id: string) => {
    const wasActive = data.goals.includes(id);
    setData((d) => ({
      ...d,
      goals: wasActive ? d.goals.filter((g) => g !== id) : [...d.goals, id],
    }));
    if (!wasActive) {
      toast.success("Added", { description: GOALS.find((g) => g.id === id)?.label, duration: 1200 });
    }
  };

  const canAdvance = useMemo(() => {
    switch (step) {
      case 0:
        return data.name.trim().length > 1 && /\S+@\S+\.\S+/.test(data.email);
      case 1:
        return !!data.role && data.company.trim().length > 0;
      case 2:
        return data.goals.length > 0;
      case 3:
        return true;
      default:
        return false;
    }
  }, [step, data]);

  const next = () => {
    if (!canAdvance) {
      toast.error("A few more details", { description: "Please complete this step to continue." });
      return;
    }
    if (step === 3) return submit();
    setStep((s) => Math.min(s + 1, STEPS.length - 1));
  };

  const submit = async () => {
    setSubmitting(true);
    await new Promise((r) => setTimeout(r, 1400));
    setSubmitting(false);
    setStep(4);
    toast.success("Welcome aboard", { description: `Thanks, ${data.name.split(" ")[0]}.` });
  };

  const reset = () => {
    setStep(0);
    setData({ name: "", email: "", role: "", company: "", goals: [], budget: 5, notes: "" });
  };

  const progress = (step / (STEPS.length - 1)) * 100;

  return (
    <div className="w-full max-w-xl">
      <div className="mb-8 px-1">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2 text-xs uppercase tracking-[0.18em] text-muted-foreground">
            <Sparkles className="h-3.5 w-3.5 text-accent" />
            <span>Onboarding</span>
          </div>
          <span className="text-xs tabular-nums text-muted-foreground">
            {Math.min(step + 1, STEPS.length)} / {STEPS.length}
          </span>
        </div>

        <div className="relative h-1.5 w-full overflow-hidden rounded-full bg-muted">
          <motion.div
            className="absolute inset-y-0 left-0 rounded-full bg-gradient-primary"
            initial={false}
            animate={{ width: `${progress}%` }}
            transition={{ type: "spring", stiffness: 120, damping: 20 }}
          />
        </div>

        <div className="mt-3 flex justify-between">
          {STEPS.map((label, i) => (
            <button
              key={label}
              onClick={() => i < step && setStep(i)}
              className={cn(
                "text-[11px] font-medium transition-colors",
                i <= step ? "text-foreground" : "text-muted-foreground/60",
                i < step ? "cursor-pointer hover:text-primary" : "cursor-default",
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="relative rounded-3xl bg-card shadow-lift border border-border/60 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-warm opacity-40 pointer-events-none" />
        <div className="relative p-7 sm:p-10 min-h-[460px] flex flex-col">
          <AnimatePresence mode="wait">
            <motion.div
              key={step}
              variants={stepVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
              className="flex-1 flex flex-col"
            >
              {step === 0 && (
                <StepShell
                  icon={<User className="h-3.5 w-3.5" />}
                  eyebrow="Step one"
                  title="Let's start with you"
                  subtitle="Just the basics so we can say hello."
                >
                  <Field label="Full name">
                    <AnimatedInput
                      value={data.name}
                      onChange={(v) => update("name", v)}
                      placeholder="Ada Lovelace"
                      autoFocus
                    />
                  </Field>
                  <Field label="Email address">
                    <AnimatedInput
                      value={data.email}
                      onChange={(v) => update("email", v)}
                      placeholder="ada@analytical.co"
                      type="email"
                      icon={<Mail className="h-4 w-4" />}
                    />
                  </Field>
                </StepShell>
              )}

              {step === 1 && (
                <StepShell
                  icon={<Briefcase className="h-3.5 w-3.5" />}
                  eyebrow="Step two"
                  title="Tell us what you do"
                  subtitle="We'll tailor your experience around it."
                >
                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-3">Your role</p>
                    <div className="grid grid-cols-2 gap-2.5">
                      {ROLES.map((r) => {
                        const active = data.role === r.id;
                        const Icon = r.icon;
                        return (
                          <motion.button
                            key={r.id}
                            type="button"
                            onClick={() => {
                              update("role", r.id);
                              toast.success(`${r.label} selected`, { duration: 900 });
                            }}
                            whileTap={{ scale: 0.97 }}
                            className={cn(
                              "relative flex items-center gap-3 rounded-2xl border px-4 py-3.5 text-left transition-all",
                              active
                                ? "border-primary bg-primary text-primary-foreground shadow-soft"
                                : "border-border bg-surface-elevated hover:border-primary/40",
                            )}
                          >
                            <Icon className="h-4 w-4 shrink-0" />
                            <span className="text-sm font-medium">{r.label}</span>
                            <AnimatePresence>
                              {active && (
                                <motion.span
                                  initial={{ scale: 0, opacity: 0 }}
                                  animate={{ scale: 1, opacity: 1 }}
                                  exit={{ scale: 0, opacity: 0 }}
                                  className="ml-auto inline-flex h-5 w-5 items-center justify-center rounded-full bg-primary-foreground text-primary"
                                >
                                  <Check className="h-3 w-3" strokeWidth={3} />
                                </motion.span>
                              )}
                            </AnimatePresence>
                          </motion.button>
                        );
                      })}
                    </div>
                  </div>
                  <Field label="Company or project">
                    <AnimatedInput
                      value={data.company}
                      onChange={(v) => update("company", v)}
                      placeholder="The Analytical Engine"
                      icon={<Building2 className="h-4 w-4" />}
                    />
                  </Field>
                </StepShell>
              )}

              {step === 2 && (
                <StepShell
                  icon={<Target className="h-3.5 w-3.5" />}
                  eyebrow="Step three"
                  title="What are you working toward?"
                  subtitle="Pick anything that resonates — choose as many as you like."
                >
                  <div className="flex flex-wrap gap-2">
                    {GOALS.map((g) => {
                      const active = data.goals.includes(g.id);
                      return (
                        <motion.button
                          key={g.id}
                          type="button"
                          onClick={() => toggleGoal(g.id)}
                          layout
                          whileTap={{ scale: 0.94 }}
                          transition={{ type: "spring", stiffness: 400, damping: 25 }}
                          className={cn(
                            "group inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm transition-colors",
                            active
                              ? "border-primary bg-primary text-primary-foreground"
                              : "border-border bg-surface-elevated hover:border-primary/40",
                          )}
                        >
                          <motion.span
                            animate={{ rotate: active ? 0 : -90, scale: active ? 1 : 0, width: active ? 14 : 0 }}
                            transition={{ type: "spring", stiffness: 500, damping: 22 }}
                            className="inline-flex overflow-hidden"
                          >
                            <Check className="h-3.5 w-3.5 shrink-0" strokeWidth={3} />
                          </motion.span>
                          {g.label}
                        </motion.button>
                      );
                    })}
                  </div>

                  <motion.p
                    key={data.goals.length}
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mt-6 text-xs text-muted-foreground"
                  >
                    {data.goals.length === 0
                      ? "Nothing selected yet."
                      : `${data.goals.length} goal${data.goals.length === 1 ? "" : "s"} selected.`}
                  </motion.p>
                </StepShell>
              )}

              {step === 3 && (
                <StepShell
                  icon={<Heart className="h-3.5 w-3.5" />}
                  eyebrow="Almost there"
                  title="A few finishing touches"
                  subtitle="Optional — anything you'd like us to know."
                >
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <p className="text-xs font-medium text-muted-foreground">Team size</p>
                      <motion.span
                        key={data.budget}
                        initial={{ scale: 0.8, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        className="rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-semibold text-primary tabular-nums"
                      >
                        {data.budget === 50 ? "50+" : data.budget} people
                      </motion.span>
                    </div>
                    <input
                      type="range"
                      min={1}
                      max={50}
                      value={data.budget}
                      onChange={(e) => update("budget", Number(e.target.value))}
                      className="w-full accent-[var(--color-primary)]"
                    />
                  </div>

                  <Field label="Anything else?">
                    <textarea
                      value={data.notes}
                      onChange={(e) => update("notes", e.target.value)}
                      placeholder="Share what excites you, what's blocking you, or what you're hoping to find..."
                      rows={4}
                      className="w-full resize-none rounded-xl border border-input bg-surface-elevated px-4 py-3 text-sm placeholder:text-muted-foreground/70 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/15 transition-all"
                    />
                  </Field>
                </StepShell>
              )}

              {step === 4 && <SuccessView name={data.name} onReset={reset} data={data} />}
            </motion.div>
          </AnimatePresence>

          {step < 4 && (
            <div className="mt-8 flex items-center justify-between gap-3">
              <button
                onClick={() => setStep((s) => Math.max(0, s - 1))}
                disabled={step === 0 || submitting}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-medium transition-all",
                  "text-muted-foreground hover:text-foreground hover:bg-muted",
                  "disabled:opacity-0 disabled:pointer-events-none",
                )}
              >
                <ArrowLeft className="h-4 w-4" /> Back
              </button>

              <motion.button
                onClick={next}
                disabled={submitting}
                whileHover={canAdvance ? { scale: 1.02 } : undefined}
                whileTap={canAdvance ? { scale: 0.97 } : undefined}
                className={cn(
                  "group relative inline-flex items-center gap-2 rounded-full px-6 py-3 text-sm font-semibold transition-all",
                  "bg-gradient-primary text-primary-foreground shadow-soft",
                  !canAdvance && "opacity-50 cursor-not-allowed",
                )}
              >
                <AnimatePresence mode="wait" initial={false}>
                  {submitting ? (
                    <motion.span
                      key="loading"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="inline-flex items-center gap-2"
                    >
                      <Loader2 className="h-4 w-4 animate-spin" /> Sending…
                    </motion.span>
                  ) : (
                    <motion.span
                      key="label"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="inline-flex items-center gap-2"
                    >
                      {step === 3 ? "Submit" : "Continue"}
                      <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                    </motion.span>
                  )}
                </AnimatePresence>
              </motion.button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function StepShell({
  icon,
  eyebrow,
  title,
  subtitle,
  children,
}: {
  icon: React.ReactNode;
  eyebrow: string;
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <div className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 text-[11px] font-medium uppercase tracking-wider text-primary mb-4">
          <span className="inline-flex">{icon}</span>
          {eyebrow}
        </div>
        <h2 className="font-display text-3xl sm:text-4xl text-foreground leading-tight">{title}</h2>
        <p className="mt-2 text-sm text-muted-foreground">{subtitle}</p>
      </div>
      <div className="flex flex-col gap-5">{children}</div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-xs font-medium text-muted-foreground mb-2">{label}</span>
      {children}
    </label>
  );
}

function AnimatedInput({
  value,
  onChange,
  placeholder,
  type = "text",
  icon,
  autoFocus,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
  icon?: React.ReactNode;
  autoFocus?: boolean;
}) {
  return (
    <div className="relative">
      {icon && (
        <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground">
          {icon}
        </span>
      )}
      <input
        autoFocus={autoFocus}
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={cn(
          "w-full rounded-xl border border-input bg-surface-elevated py-3 text-sm",
          "placeholder:text-muted-foreground/70 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/15 transition-all",
          icon ? "pl-10 pr-4" : "px-4",
        )}
      />
    </div>
  );
}

function SuccessView({ name, data, onReset }: { name: string; data: FormData; onReset: () => void }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center text-center py-6">
      <motion.div
        initial={{ scale: 0, rotate: -45 }}
        animate={{ scale: 1, rotate: 0 }}
        transition={{ type: "spring", stiffness: 200, damping: 14, delay: 0.05 }}
        className="relative mb-6"
      >
        <div className="h-20 w-20 rounded-full bg-gradient-primary flex items-center justify-center shadow-lift">
          <Check className="h-9 w-9 text-primary-foreground" strokeWidth={3} />
        </div>
        <motion.span
          className="absolute inset-0 rounded-full border-2 border-primary"
          initial={{ scale: 1, opacity: 0.6 }}
          animate={{ scale: 1.8, opacity: 0 }}
          transition={{ duration: 1.2, repeat: Infinity, ease: "easeOut" }}
        />
      </motion.div>

      <motion.h2
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        className="font-display text-3xl sm:text-4xl text-foreground"
      >
        You're all set, {name.split(" ")[0] || "friend"}.
      </motion.h2>
      <motion.p
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
        className="mt-3 max-w-sm text-sm text-muted-foreground"
      >
        We've saved your responses and will tailor what comes next around them.
      </motion.p>

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.6 }}
        className="mt-7 w-full max-w-sm rounded-2xl border border-border bg-surface-elevated p-5 text-left"
      >
        <p className="text-[11px] uppercase tracking-wider text-muted-foreground mb-3">Summary</p>
        <dl className="space-y-2 text-sm">
          <Row k="Email" v={data.email} />
          <Row k="Role" v={ROLES.find((r) => r.id === data.role)?.label ?? "—"} />
          <Row k="Company" v={data.company} />
          <Row k="Goals" v={data.goals.length ? `${data.goals.length} selected` : "—"} />
          <Row k="Team" v={`${data.budget === 50 ? "50+" : data.budget} people`} />
        </dl>
      </motion.div>

      <motion.button
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.8 }}
        onClick={onReset}
        className="mt-6 text-sm font-medium text-primary hover:underline underline-offset-4"
      >
        Start over
      </motion.button>
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-muted-foreground">{k}</dt>
      <dd className="font-medium text-foreground text-right truncate">{v}</dd>
    </div>
  );
}
