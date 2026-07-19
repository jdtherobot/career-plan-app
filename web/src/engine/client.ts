/* Promise bridge to the Pyodide engine worker. One worker, queued requests.
   The worker is always built from a Blob (source bundled via ?raw) so the
   same code path works from the live app and from the exported single-file
   app on file:// — the engine package location travels in the init message. */

import { EMBEDDED, b64ToBytes } from "../embedded";
import workerSource from "./engine-worker-source.js?raw";

type Pending = { resolve: (v: string) => void; reject: (e: Error) => void };

let worker: Worker | null = null;
let nextId = 1;
const pending = new Map<number, Pending>();
const statusListeners = new Set<(s: EngineStatus) => void>();
// In an exported snapshot the engine stays idle until the first edit.
let status: EngineStatus = EMBEDDED ? "idle" : "loading";

export type EngineStatus = "idle" | "loading" | "ready" | "error";

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
  const blobUrl = URL.createObjectURL(new Blob([workerSource], { type: "text/javascript" }));
  try {
    worker = new Worker(blobUrl);
  } catch (error) {
    setStatus("error");
    throw error;
  }
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
  if (EMBEDDED) {
    // The snapshot carries the engine package; no origin to fetch it from.
    const bytes = b64ToBytes(EMBEDDED.zipB64);
    worker.postMessage({ cmd: "init", zipBytes: bytes.buffer }, [bytes.buffer]);
  } else {
    // The blob worker cannot resolve page-relative URLs — hand it an absolute one.
    const zipUrl = new URL(
      `${import.meta.env.BASE_URL}planner_app.zip?v=${__BUILD_ID__}`,
      window.location.href,
    ).href;
    worker.postMessage({ cmd: "init", zipUrl });
  }
  setStatus("loading");
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
