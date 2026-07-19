/* App state: planner payload + engine results, persisted to IndexedDB with
   JSON export/import for backup. Any payload edit triggers a debounced
   recompute in the Pyodide worker. */

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  type ReactNode,
} from "react";
import { computePayload, onEngineStatus, startEngine, type EngineStatus } from "../engine/client";

export type Theme = "light" | "dark";

export interface AppState {
  profile: any;
  scenarios: any[];
  manualInputs: any;
  baselineId: string | null;
  referenceOverrides: any[];
  bootstrap: any | null;
  results: any | null;
  errors: Record<string, string[]> | null;
  engineStatus: EngineStatus;
  computing: boolean;
  realDollars: boolean;
  theme: Theme;
  chartsEnabled: string[];
  focusPathId: string | null;
  panelBrightness: number;
  hydrated: boolean;
}

export const DEFAULT_CHARTS = ["net_cf", "portfolio", "income", "spending"];
export const FALLBACK_CHART = "net_cf";
const VALID_CHARTS = new Set(["net_cf", "portfolio", "income", "spending", "savings", "taxes", "healthcare", "retirement_income"]);

const initial: AppState = {
  profile: null,
  scenarios: [],
  manualInputs: null,
  baselineId: null,
  referenceOverrides: [],
  bootstrap: null,
  results: null,
  errors: null,
  engineStatus: "loading",
  computing: false,
  realDollars: true,
  theme:
    (localStorage.getItem("cpc-theme") as Theme) ||
    (window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light"),
  chartsEnabled: (() => {
    const stored = JSON.parse(localStorage.getItem("cpc-charts") || "null");
    const migrate: Record<string, string> = { income_vs_expenses: "net_cf", income_comp: "income", expense_comp: "spending" };
    const valid = Array.isArray(stored)
      ? [...new Set(stored.map((id: string) => migrate[id] ?? id))].filter((id) => VALID_CHARTS.has(id))
      : [];
    return valid.length ? valid : DEFAULT_CHARTS;
  })(),
  focusPathId: null,
  panelBrightness: Number(localStorage.getItem("cpc-panel-bright") ?? 25),
  hydrated: false,
};

type Action =
  | { type: "hydrate"; payload: Partial<AppState> }
  | { type: "bootstrap"; bootstrap: any }
  | { type: "engineStatus"; status: EngineStatus }
  | { type: "computing"; value: boolean }
  | { type: "results"; results: any }
  | { type: "errors"; errors: Record<string, string[]> }
  | { type: "setScenarios"; scenarios: any[] }
  | { type: "setManualInputs"; manualInputs: any }
  | { type: "setBaseline"; id: string }
  | { type: "setOverrides"; overrides: any[] }
  | { type: "setRealDollars"; value: boolean }
  | { type: "setTheme"; value: Theme }
  | { type: "setChartsEnabled"; charts: string[] }
  | { type: "setFocusPath"; id: string | null }
  | { type: "setPanelBrightness"; value: number }
  | { type: "replaceAll"; payload: Partial<AppState> };

function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case "hydrate":
      return { ...state, ...action.payload, hydrated: true };
    case "bootstrap":
      return { ...state, bootstrap: action.bootstrap };
    case "engineStatus":
      return { ...state, engineStatus: action.status };
    case "computing":
      return { ...state, computing: action.value };
    case "results":
      return { ...state, results: action.results, errors: null, computing: false };
    case "errors":
      return { ...state, errors: action.errors, computing: false };
    case "setScenarios":
      return { ...state, scenarios: action.scenarios };
    case "setManualInputs":
      return { ...state, manualInputs: action.manualInputs };
    case "setBaseline":
      return { ...state, baselineId: action.id };
    case "setOverrides":
      return { ...state, referenceOverrides: action.overrides };
    case "setRealDollars":
      return { ...state, realDollars: action.value };
    case "setTheme":
      localStorage.setItem("cpc-theme", action.value);
      document.documentElement.dataset.theme = action.value;
      return { ...state, theme: action.value };
    case "setChartsEnabled": {
      // Never allow an empty chart set — income vs expenses is the floor.
      const charts = action.charts.length ? action.charts : [FALLBACK_CHART];
      localStorage.setItem("cpc-charts", JSON.stringify(charts));
      return { ...state, chartsEnabled: charts };
    }
    case "setFocusPath":
      return { ...state, focusPathId: action.id };
    case "setPanelBrightness":
      localStorage.setItem("cpc-panel-bright", String(action.value));
      applyPanelBrightness(action.value);
      return { ...state, panelBrightness: action.value };
    case "replaceAll":
      return { ...state, ...action.payload };
    default:
      return state;
  }
}

/* ---------- IndexedDB (tiny, no deps) ---------- */

const DB_NAME = "career-plan-codex";
const STORE = "state";

function idbOpen(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function idbGet(key: string): Promise<any> {
  const db = await idbOpen();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readonly").objectStore(STORE).get(key);
    tx.onsuccess = () => resolve(tx.result);
    tx.onerror = () => reject(tx.error);
  });
}

async function idbSet(key: string, value: any): Promise<void> {
  const db = await idbOpen();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite").objectStore(STORE).put(value, key);
    tx.onsuccess = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function idbClear(): Promise<void> {
  const db = await idbOpen();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite").objectStore(STORE).clear();
    tx.onsuccess = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

/* ---------- context ---------- */

const StateCtx = createContext<AppState>(initial);
const DispatchCtx = createContext<(a: Action) => void>(() => {});

export function useAppState() {
  return useContext(StateCtx);
}
export function useDispatch() {
  return useContext(DispatchCtx);
}

export function buildPayload(state: AppState) {
  return {
    plannerProfile: state.profile,
    scenarios: state.scenarios,
    manualInputs: state.manualInputs,
    baselineId: state.baselineId,
    referenceOverrides: state.referenceOverrides,
  };
}

export function exportStateJson(state: AppState): string {
  return JSON.stringify(
    {
      version: 2,
      exportedAt: new Date().toISOString(),
      plannerProfile: state.profile,
      scenarios: state.scenarios,
      manualInputs: state.manualInputs,
      baselineId: state.baselineId,
      referenceOverrides: state.referenceOverrides,
    },
    null,
    2,
  );
}

export async function clearLocalData(): Promise<void> {
  await idbClear();
  window.location.reload();
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initial);
  const computeSeq = useRef(0);
  const debounceTimer = useRef<number | undefined>(undefined);

  // Boot: bootstrap data + saved state + engine warm-up.
  useEffect(() => {
    document.documentElement.dataset.theme = initial.theme;
    applyPanelBrightness(initial.panelBrightness);
    startEngine();
    const offStatus = onEngineStatus((status) => dispatch({ type: "engineStatus", status }));
    (async () => {
      const resp = await fetch(`${import.meta.env.BASE_URL}planner_data.json`);
      const bootstrap = await resp.json();
      dispatch({ type: "bootstrap", bootstrap });
      let saved: any = null;
      try {
        saved = await idbGet("payload");
      } catch {
        /* private-mode etc. — run without persistence */
      }
      // Durable personal baseline (gitignored, owner's machine only): when the
      // browser has no saved state, restore from it instead of demo defaults.
      // The public site 404s here and falls back to the sanitized bundle.
      let personal: any = null;
      if (!saved) {
        try {
          const p = await fetch(`${import.meta.env.BASE_URL}personal_baseline.local.json`);
          if (p.ok) personal = await p.json();
        } catch {
          /* offline or absent — demo defaults */
        }
      }
      const defaults = bootstrap.defaults;
      const seed = saved ?? personal ?? {};
      dispatch({
        type: "hydrate",
        payload: {
          profile: seed.plannerProfile ?? defaults.plannerProfile,
          scenarios: seed.scenarios ?? defaults.scenarios,
          manualInputs: seed.manualInputs ?? defaults.manualInputs,
          baselineId: seed.baselineId ?? defaults.baselineId,
          referenceOverrides: seed.referenceOverrides ?? [],
        },
      });
    })();
    return offStatus;
  }, []);

  // Persist + recompute on payload change (debounced).
  useEffect(() => {
    if (!state.hydrated || state.engineStatus !== "ready") return;
    const payload = buildPayload(state);
    idbSet("payload", payload).catch(() => {});
    window.clearTimeout(debounceTimer.current);
    debounceTimer.current = window.setTimeout(async () => {
      const seq = ++computeSeq.current;
      dispatch({ type: "computing", value: true });
      try {
        const result = await computePayload(payload);
        if (seq !== computeSeq.current) return; // stale
        if (result.ok) dispatch({ type: "results", results: result });
        else dispatch({ type: "errors", errors: result.errors });
      } catch (error) {
        if (seq === computeSeq.current)
          dispatch({ type: "errors", errors: { engine: [String(error)] } });
      }
    }, 250);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    state.hydrated,
    state.engineStatus,
    state.scenarios,
    state.manualInputs,
    state.baselineId,
    state.referenceOverrides,
    state.profile,
  ]);

  const dispatchStable = useMemo(() => dispatch, []);
  return (
    <StateCtx.Provider value={state}>
      <DispatchCtx.Provider value={dispatchStable}>{children}</DispatchCtx.Provider>
    </StateCtx.Provider>
  );
}

/* ---------- shared formatting & palettes ----------
   Cybernetic Premium: panels are carbon material in BOTH modes (the cream-card
   inversion was too bright for night data work), so one chart palette serves
   both — validator-passed against carbon #17161A through the brightest
   panel-slider position (#393735). */

/* Material-derived accents (validated on carbon through the slider range):
   paths — brass, anodized steel, verdigris, titanium violet;
   cats  — copper, steel, verdigris, ti-violet, brass, rose. */
const CARBON_PATHS = ["#BD8322", "#4E8FC4", "#4AA173", "#9A6BB5"];
const CARBON_CATS = ["#B5714B", "#4E8FC4", "#4AA173", "#9A6BB5", "#BD8322", "#C56A8C"];

export const PATH_COLORS: Record<Theme, string[]> = { light: CARBON_PATHS, dark: CARBON_PATHS };
export const CAT_COLORS: Record<Theme, string[]> = { light: CARBON_CATS, dark: CARBON_CATS };
export const NEGATIVE_COLORS: Record<Theme, string> = { light: "#D06557", dark: "#D06557" };

/* Panel brightness: slider 0–100 → cream-into-carbon mix 2%–14% on .card. */
export function applyPanelBrightness(value: number): void {
  const mix = 2 + (Math.min(Math.max(value, 0), 100) / 100) * 12;
  document.documentElement.style.setProperty("--panel-mix", `${mix.toFixed(1)}%`);
}

export function pathColor(index: number, theme: Theme = "light"): string {
  const palette = PATH_COLORS[theme];
  return palette[index % palette.length];
}

export function fmtMoney(value: number | null | undefined, compact = false): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  if (compact) {
    const abs = Math.abs(value);
    if (abs >= 1_000_000) return `$${(value / 1_000_000).toFixed(2)}M`;
    if (abs >= 1_000) return `$${(value / 1_000).toFixed(0)}K`;
  }
  return `$${Math.round(value).toLocaleString()}`;
}
