import { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

type Padding = "none" | "sm" | "md" | "lg" | "xl";

const paddingClasses: Record<Padding, string> = {
  none: "",
  sm: "p-4",
  md: "p-5",
  lg: "p-6",
  xl: "p-8",
};

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  padding?: Padding;
}

export function Card({ padding = "md", className, children, ...props }: CardProps) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900",
        paddingClasses[padding],
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}
