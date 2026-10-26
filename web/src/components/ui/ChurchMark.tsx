import { cn } from "@/lib/utils";

/** Line drawing of a village church: nave, tower, cross. */
export function ChurchMark({ className }: { className?: string }) {
  return (
    <svg
      width="34"
      height="40"
      viewBox="0 0 34 40"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinejoin="round"
      strokeLinecap="round"
      aria-hidden="true"
      className={cn("shrink-0 text-ink", className)}
    >
      <path d="M12 2v5M9.5 4.5h5" />
      <path d="M8 39V14l4-6 4 6v25" />
      <path d="M16 20h13l3 5v14H16" />
      <path d="M8 39H2V27l6-4" />
      <path d="M11 32h2M25 32h2M10.5 17.5h3" />
      <path d="M1 39h32" />
    </svg>
  );
}
