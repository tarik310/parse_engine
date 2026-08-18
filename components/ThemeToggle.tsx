"use client";

import { Sun, Moon } from "lucide-react";
import { Button } from "@/components/shadcn_ui/button";
import { useTheme } from "@/components/ThemeProvider";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/shadcn_ui/tooltip";
import { useEffect, useState } from "react";

export function ThemeToggle() {
  const { theme, toggle } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const setMountedTrue = () => {
      setMounted(true);
    };
    setMountedTrue();
  }, []);

  return (
    <div className="fixed bottom-6 right-6 z-50">
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              onClick={toggle}
              variant="outline"
              size="icon"
              className="size-10 rounded-full shadow-lg cursor-pointer border-border bg-background hover:bg-muted"
              aria-label="Toggle theme"
            >
              {mounted &&
                (theme === "dark" ? <Sun className="size-4" /> : <Moon className="size-4" />)}
            </Button>
          </TooltipTrigger>
          <TooltipContent side="left">
            {mounted
              ? theme === "dark"
                ? "Switch to light mode"
                : "Switch to dark mode"
              : "Toggle theme"}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </div>
  );
}
