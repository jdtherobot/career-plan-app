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

const SCREENS: { id: string; label: string; icon: string }[] = [
  { id: "dashboard", label: "Dashboard", icon: "◆" },
  { id: "paths", label: "Path Builder", icon: "⧉" },
  { id: "finances", label: "Finances", icon: "¤" },
  { id: "explorer", label: "Explorer", icon: "☰" },
  { id: "assumptions", label: "Assumptions", icon: "⚙" },
  { id: "sources", label: "Sources", icon: "¶" },
  { id: "export", label: "Export", icon: "⇩" },
];

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
    <div className="toggle" role="group" aria-label="Theme" style={{ margin: "0 10px 8px" }}>
      <button className={theme === "light" ? "on" : ""} onClick={() => dispatch({ type: "setTheme", value: "light" })}>
        Day
      </button>
      <button className={theme === "dark" ? "on" : ""} onClick={() => dispatch({ type: "setTheme", value: "dark" })}>
        Night
      </button>
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
      <nav className="rail" aria-label="Primary">
        <div className="brand">
          <p className="eyebrow">Career Plan Codex</p>
          <h1>Financial Planner</h1>
        </div>
        {SCREENS.map((s) => (
          <a key={s.id} href={`#${s.id}`} className={route === s.id ? "active" : ""}>
            <span aria-hidden="true">{s.icon}</span>
            {s.label}
          </a>
        ))}
        <div className="spacer" />
        <ThemeSwitch />
        <EnginePill />
      </nav>
      <main className="main">
        <ErrorBoundary>{screen}</ErrorBoundary>
      </main>
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
