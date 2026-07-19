/* Promise bridge to the Pyodide engine worker. One worker, queued requests. */

type Pending = { resolve: (v: string) => void; reject: (e: Error) => void };

let worker: Worker | null = null;
let nextId = 1;
const pending = new Map<number, Pending>();
const statusListeners = new Set<(s: EngineStatus) => void>();
let status: EngineStatus = "loading";

export type EngineStatus = "loading" | "ready" | "error";

function setStatus(next: EngineStatus) {
  status = next;
  statusListeners.forEach((fn) => fn(next));
}

export function onEngineStatus(fn: (s: EngineStatus) => void): () => void {
  statusListeners.add(fn);
  fn(status);
  return () => statusListeners.delete(fn);
}

function getWorker(): Worker {
  if (worker) return worker;
  worker = new Worker(`${import.meta.env.BASE_URL}engine-worker.js?v=${__BUILD_ID__}`);
  worker.onmessage = (event) => {
    const { id, ok, result, error } = event.data;
    const entry = pending.get(id);
    if (!entry) return;
    pending.delete(id);
    if (ok) entry.resolve(result);
    else entry.reject(new Error(error));
  };
  worker.onerror = (event) => {
    setStatus("error");
    pending.forEach((entry) => entry.reject(new Error(event.message || "Engine worker failed")));
    pending.clear();
  };
  // First ping resolves once Pyodide + planner_app are fully loaded.
  call("ping", "").then(
    () => setStatus("ready"),
    () => setStatus("error"),
  );
  return worker;
}

function call(cmd: string, arg: string): Promise<string> {
  const w = getWorker();
  const id = nextId++;
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject });
    w.postMessage({ id, cmd, arg });
  });
}

export function startEngine(): void {
  getWorker();
}

export async function computePayload(payload: unknown): Promise<any> {
  const raw = await call("compute", JSON.stringify(payload));
  return JSON.parse(raw);
}

export async function exportXlsxBase64(
  result: unknown,
  payload: unknown,
  meta: unknown,
): Promise<string> {
  return call("export_xlsx", JSON.stringify({ result, payload, meta }));
}

export async function exportHtml(result: unknown): Promise<string> {
  return call("export_html", JSON.stringify(result));
}
