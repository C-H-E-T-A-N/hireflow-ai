"use client";

import { Monitor, Moon, Sun } from "lucide-react";
import * as React from "react";

import { cn } from "@/lib/utils";

type Theme = "light" | "dark" | "system";

const STORAGE_KEY = "hireflow-theme";

const ThemeContext = React.createContext<{
  theme: Theme;
  setTheme: (theme: Theme) => void;
}>({ theme: "system", setTheme: () => {} });

/**
 * localStorage treated as an external store.
 *
 * Reading it through `useSyncExternalStore` keeps the server snapshot ("system")
 * and the client snapshot consistent during hydration, and avoids a
 * setState-in-effect cascade on every mount.
 */
const themeStore = {
  listeners: new Set<() => void>(),
  subscribe(listener: () => void) {
    themeStore.listeners.add(listener);
    return () => themeStore.listeners.delete(listener);
  },
  getSnapshot(): Theme {
    try {
      return (window.localStorage.getItem(STORAGE_KEY) as Theme | null) ?? "system";
    } catch {
      return "system";
    }
  },
  getServerSnapshot(): Theme {
    return "system";
  },
  set(theme: Theme) {
    try {
      window.localStorage.setItem(STORAGE_KEY, theme);
    } catch {
      /* Private browsing or storage disabled: fall back to in-memory only. */
    }
    themeStore.listeners.forEach((listener) => listener());
  },
};

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const theme = React.useSyncExternalStore(
    themeStore.subscribe,
    themeStore.getSnapshot,
    themeStore.getServerSnapshot,
  );

  React.useEffect(() => {
    const root = document.documentElement;
    const media = window.matchMedia("(prefers-color-scheme: dark)");

    const apply = () => {
      const dark = theme === "dark" || (theme === "system" && media.matches);
      root.classList.toggle("dark", dark);
    };

    apply();
    media.addEventListener("change", apply);
    return () => media.removeEventListener("change", apply);
  }, [theme]);

  const setTheme = React.useCallback((next: Theme) => {
    themeStore.set(next);
  }, []);

  const value = React.useMemo(() => ({ theme, setTheme }), [theme, setTheme]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  return React.useContext(ThemeContext);
}

const OPTIONS: Array<{ value: Theme; icon: typeof Sun; label: string }> = [
  { value: "light", icon: Sun, label: "Light" },
  { value: "dark", icon: Moon, label: "Dark" },
  { value: "system", icon: Monitor, label: "System" },
];

export function ThemeToggle({ className }: { className?: string }) {
  const { theme, setTheme } = useTheme();

  return (
    <div
      className={cn(
        "inline-flex items-center gap-0.5 rounded-lg border border-line bg-surface-muted p-0.5",
        className,
      )}
      role="radiogroup"
      aria-label="Colour theme"
    >
      {OPTIONS.map((option) => {
        const Icon = option.icon;
        const active = theme === option.value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={active}
            aria-label={option.label}
            onClick={() => setTheme(option.value)}
            className={cn(
              "rounded-md p-1.5 transition-colors",
              active
                ? "bg-surface text-ink shadow-xs"
                : "text-ink-tertiary hover:text-ink-secondary",
            )}
          >
            <Icon className="size-3.5" />
          </button>
        );
      })}
    </div>
  );
}

/**
 * Applies the stored theme before first paint so a dark-mode user never sees a
 * white flash. Runs as a blocking inline script in <head>.
 */
export function ThemeScript() {
  const script = `(function(){try{var t=localStorage.getItem("${STORAGE_KEY}")||"system";var d=t==="dark"||(t==="system"&&window.matchMedia("(prefers-color-scheme: dark)").matches);if(d)document.documentElement.classList.add("dark");}catch(e){}})();`;
  return <script dangerouslySetInnerHTML={{ __html: script }} />;
}
