import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";

export type NavStyle = "sidebar" | "pills";
export type Theme = "light" | "dark" | "system";

type Ctx = {
  style: NavStyle;
  setStyle: (s: NavStyle) => void;
  theme: Theme;
  setTheme: (t: Theme) => void;
  resolvedTheme: "light" | "dark";
};

const NavCtx = createContext<Ctx>({
  style: "sidebar",
  setStyle: () => {},
  theme: "system",
  setTheme: () => {},
  resolvedTheme: "light",
});

const NAV_KEY = "taskboard:nav-style";
const THEME_KEY = "taskboard:theme";

function systemPrefersDark(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia?.("(prefers-color-scheme: dark)").matches ?? false;
}

function applyThemeClass(resolved: "light" | "dark") {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  if (resolved === "dark") root.classList.add("dark");
  else root.classList.remove("dark");
}

export function NavPrefsProvider({ children }: { children: ReactNode }) {
  const [style, setStyleState] = useState<NavStyle>("sidebar");
  const [theme, setThemeState] = useState<Theme>("system");
  const [resolvedTheme, setResolvedTheme] = useState<"light" | "dark">("light");

  // Hydrate from localStorage
  useEffect(() => {
    if (typeof window === "undefined") return;
    const v = window.localStorage.getItem(NAV_KEY);
    if (v === "sidebar" || v === "pills") setStyleState(v);
    const t = window.localStorage.getItem(THEME_KEY);
    if (t === "light" || t === "dark" || t === "system") setThemeState(t);
  }, []);

  // Apply theme + react to system changes
  useEffect(() => {
    const compute = (): "light" | "dark" =>
      theme === "system" ? (systemPrefersDark() ? "dark" : "light") : theme;
    const r = compute();
    setResolvedTheme(r);
    applyThemeClass(r);
    if (theme !== "system" || typeof window === "undefined") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => {
      const r2 = compute();
      setResolvedTheme(r2);
      applyThemeClass(r2);
    };
    mq.addEventListener?.("change", onChange);
    return () => mq.removeEventListener?.("change", onChange);
  }, [theme]);

  const setStyle = (s: NavStyle) => {
    setStyleState(s);
    if (typeof window !== "undefined") window.localStorage.setItem(NAV_KEY, s);
  };
  const setTheme = (t: Theme) => {
    setThemeState(t);
    if (typeof window !== "undefined")
      window.localStorage.setItem(THEME_KEY, t);
  };

  return (
    <NavCtx.Provider
      value={{ style, setStyle, theme, setTheme, resolvedTheme }}
    >
      {children}
    </NavCtx.Provider>
  );
}

export const useNavPrefs = () => useContext(NavCtx);
