"use client";

import { Button } from "@/components/ui/button";
import { BarChart3 } from "lucide-react";
import { cn } from "@/lib/utils";

type DuneDashboardButtonProps = {
  className?: string;
  variant?: "default" | "outline" | "ghost";
  size?: "default" | "sm" | "lg" | "icon";
};

export function DuneDashboardButton({
  className,
  variant = "default",
  size = "default",
}: DuneDashboardButtonProps) {
  const handleOpenDune = () => {
    window.open("https://dune.com/xyk/donut-company", "_blank", "noopener,noreferrer");
  };

  return (
    <Button
      onClick={handleOpenDune}
      variant={variant}
      size={size}
      className={cn("gap-2 transition-all", className)}
    >
      <BarChart3 className="h-4 w-4" />
      <span>Dune Dashboard</span>
    </Button>
  );
}
