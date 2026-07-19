import { Component, useEffect, useState, type ReactNode } from "react";
import { StoreProvider, useAppState, useDispatch } from "./state/store";

class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  render() {
    if (this.state.error) {
      return (
        <div className="error-box" style={{ margin: 20 }}>
          <strong>Something broke rendering this view.</strong>
          <pre style={{ whiteSpace: "pre-wrap", fontSize: 12 }}>{String(this.state.error?.stack ?? this.state.error)}</pre>
          <button onClick={() => this.setState({ error: null })}>Try again</button>
        </div>
      );
    }
    return this.props.children;
  }
}
import { Dashboard } from "./screens/Dashboard";
import { Paths } from "./screens/Paths";
import { Finances } from "./screens/Finances";
import { Explorer } from "./screens/Explorer";
import { Assumptions } from "./screens/Assumptions";
import { Sources } from "./screens/Sources";
import { ExportScreen } from "./screens/ExportScreen";

const SCREENS: { id: string; label: string }[] = [
  { id: "dashboard", label: "Dashboard" },
  { id: "paths", label: "Path Builder" },
  { id: "finances", label: "Finances" },
  { id: "explorer", label: "Explorer" },
  { id: "assumptions", label: "Assumptions" },
  { id: "sources", label: "Sources" },
  { id: "export", label: "Export" },
];

/* The signature motif — JD Britt neural waveform trace (gold polyline). */
function WaveTrace() {
  return (
    <svg className="wave" viewBox="0 0 280 40" aria-hidden="true" focusable="false">
      <polyline
        points="0,20 40,20 48,6 56,34 64,20 120,20 128,10 136,20 180,20 188,4 196,36 204,20 280,20"
        fill="none"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/* Site header — keeps the planner visibly part of britt.gg and links back to the
   main site's sections. Same design system (gold #C9A45E, Rajdhani/JetBrains
   Mono, square hairlines) so it auto-themes off data-theme. Links are absolute
   and open in the same tab; planner state persists in-browser. The compact spike
   mark (not the sidebar's long waveform) marks this as site-level chrome. */
const SITE = "https://britt.gg/";
const SITE_LINKS: { label: string; href: string }[] = [
  { label: "Background", href: "https://britt.gg/#sec-background" },
  { label: "Research Direction", href: "https://britt.gg/#sec-research" },
  { label: "Work", href: "https://britt.gg/#sec-work" },
  { label: "Projects", href: "https://britt.gg/#sec-projects" },
];

function SiteHeader() {
  return (
    <header className="site-header">
      <div className="site-header-inner">
        <a className="site-brand" href={SITE} aria-label="JD Britt — britt.gg home">
          <svg className="site-mark" viewBox="0 0 32 32" aria-hidden="true" focusable="false">
            <polyline
              points="2,16 10,16 13,5 17,27 20,16 30,16"
              fill="none"
              strokeWidth="2.6"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          <span className="site-wordmark">JD BRITT</span>
        </a>
        <nav className="site-links" aria-label="Site sections">
          {SITE_LINKS.map((l) => (
            <a key={l.href} href={l.href}>
              {l.label}
            </a>
          ))}
        </nav>
      </div>
    </header>
  );
}

function useHashRoute(): string {
  const [route, setRoute] = useState(() => window.location.hash.replace("#", "") || "dashboard");
  useEffect(() => {
    const onHash = () => setRoute(window.location.hash.replace("#", "") || "dashboard");
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);
  return route;
}

function ThemeSwitch() {
  const { theme } = useAppState();
  const dispatch = useDispatch();
  return (
    <div className="toggle mode-toggle" role="group" aria-label="Theme" style={{ margin: "0 10px 8px" }}>
      <button className={theme === "light" ? "on" : ""} onClick={() => dispatch({ type: "setTheme", value: "light" })}>
        Day
      </button>
      <button className={theme === "dark" ? "on" : ""} onClick={() => dispatch({ type: "setTheme", value: "dark" })}>
        Night
      </button>
    </div>
  );
}

function PanelBrightness() {
  const { panelBrightness } = useAppState();
  const dispatch = useDispatch();
  return (
    <div className="panel-bright" title="Panel brightness — warms the carbon panels toward bone">
      <label htmlFor="panelBright">Panel brightness</label>
      <input
        id="panelBright"
        type="range"
        min={0}
        max={100}
        step={5}
        value={panelBrightness}
        onChange={(e) => dispatch({ type: "setPanelBrightness", value: Number(e.target.value) })}
      />
    </div>
  );
}

function EnginePill() {
  const { engineStatus, computing } = useAppState();
  const label =
    engineStatus === "loading"
      ? "engine loading…"
      : engineStatus === "error"
        ? "engine error"
        : computing
          ? "computing…"
          : "engine ready";
  return (
    <div className={`engine-pill ${engineStatus}`}>
      <span className="dot" />
      {label}
    </div>
  );
}

function Shell() {
  const route = useHashRoute();
  const screen =
    route === "paths" ? (
      <Paths />
    ) : route === "finances" ? (
      <Finances />
    ) : route === "explorer" ? (
      <Explorer />
    ) : route === "assumptions" ? (
      <Assumptions />
    ) : route === "sources" ? (
      <Sources />
    ) : route === "export" ? (
      <ExportScreen />
    ) : (
      <Dashboard />
    );
  return (
    <>
      <SiteHeader />
      <div className="shell-row">
        <nav className="rail" aria-label="Primary">
          <div className="brand">
            <WaveTrace />
            <p className="eyebrow">Career Plan</p>
            <h1>Financial Planner</h1>
          </div>
          {SCREENS.map((s) => (
            <a key={s.id} href={`#${s.id}`} className={route === s.id ? "active" : ""}>
              {s.label}
            </a>
          ))}
          <div className="spacer" />
          <ThemeSwitch />
          <PanelBrightness />
          <EnginePill />
        </nav>
        <main className="main">
          <ErrorBoundary>{screen}</ErrorBoundary>
        </main>
      </div>
    </>
  );
}

export default function App() {
  return (
    <StoreProvider>
      <Shell />
    </StoreProvider>
  );
}
