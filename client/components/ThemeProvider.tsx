import React, { createContext, useContext, useEffect } from "react";

interface ThemeContextType {
  theme: "dark";
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

/**
 * Gaming platform — always dark mode.
 * Forces class="dark" on <html> and clears any old light-mode preference.
 */
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    const root = document.documentElement;
    root.classList.remove("light");
    root.classList.add("dark");
    // Clear any stale light-mode preference from localStorage
    localStorage.setItem("bingo.theme", "dark");
  }, []);

  return (
    <ThemeContext.Provider value={{ theme: "dark", toggleTheme: () => { } }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return context;
}

/** Removed theme toggle — gaming apps are always dark 🎮 */
export function ThemeToggle({ className = "" }: { className?: string }) {
  return (
    <div
      className={`p-2 rounded-lg border border-purple-500/30 bg-purple-500/10 text-purple-400 text-xs font-bold ${className}`}
      title="Dark mode — always on"
    >
      🌑
    </div>
  );
}
