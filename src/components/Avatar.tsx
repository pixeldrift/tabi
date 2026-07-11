import { cn } from "@/lib/utils";

// A Vite-resolved image import always yields a URL string starting with
// "/" — every emoji placeholder in this demo dataset (still in use where a
// real photo hasn't been supplied yet) never does, so that's enough to tell
// the two apart without a separate "kind" field on every record.
export function Avatar({ value, className }: { value: string; className?: string }) {
  if (value.startsWith("/")) {
    return <img src={value} alt="" className={cn("h-full w-full rounded-full object-cover", className)} />;
  }
  return <span className={className}>{value}</span>;
}
