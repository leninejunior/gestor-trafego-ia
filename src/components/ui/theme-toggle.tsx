"use client";

import * as React from "react";
import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { cn } from "@/lib/utils";

interface ThemeToggleProps {
  collapsed?: boolean;
}

export function ThemeToggle({ collapsed = false }: ThemeToggleProps) {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <div className={cn(
        "flex items-center gap-2 p-2 rounded-lg bg-muted/50",
        collapsed && "justify-center"
      )}>
        <div className="w-5 h-5 animate-pulse bg-muted rounded" />
      </div>
    );
  }

  const isDark = theme === "dark";

  return (
    <button
      onClick={() => setTheme(isDark ? "light" : "dark")}
      className={cn(
        "flex items-center gap-2 p-2 rounded-lg transition-all duration-200",
        "hover:bg-accent text-muted-foreground hover:text-foreground",
        collapsed && "justify-center w-full"
      )}
      title={isDark ? "Mudar para tema claro" : "Mudar para tema escuro"}
    >
      {isDark ? (
        <Sun className="w-5 h-5 text-yellow-500" />
      ) : (
        <Moon className="w-5 h-5 text-blue-500" />
      )}
      {!collapsed && (
        <span className="text-sm font-medium">
          {isDark ? "Tema Claro" : "Tema Escuro"}
        </span>
      )}
    </button>
  );
}
