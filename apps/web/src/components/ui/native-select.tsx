import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

export function NativeSelect({
  className,
  ...props
}: ComponentProps<"select">) {
  return (
    <select
      data-slot="native-select"
      className={cn(
        "min-w-0 rounded-lg border border-input bg-card px-3 py-2 text-sm text-card-foreground disabled:opacity-50",
        className,
      )}
      {...props}
    />
  );
}
