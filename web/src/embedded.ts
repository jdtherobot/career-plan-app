/* Embedded-snapshot contract for the single-file app export.

   The exported file's placeholder script assigns window.__EMBEDDED__ before
   the bundle runs. When present, the app boots entirely from this bundle —
   no fetches, no IndexedDB — and only starts the Pyodide engine (CDN,
   internet required) when the user actually edits something. */

export interface EmbeddedBundle {
  version: 1;
  exportedAt: string;
  inputHash: string;
  payload: {
    plannerProfile: any;
    scenarios: any[];
    manualInputs: any;
    baselineId: string | null;
    referenceOverrides: any[];
  };
  results: any;
  bootstrap: any;
  uiPrefs: {
    theme: "light" | "dark";
    chartsEnabled: string[];
    realDollars: boolean;
    panelBrightness: number;
  };
  zipB64: string;
}

export const EMBEDDED: EmbeddedBundle | null = (window as any).__EMBEDDED__ ?? null;

/* Chunked decode — a spread into fromCharCode would blow the stack at ~300KB. */
export function b64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

export function bytesToB64(bytes: Uint8Array): string {
  let bin = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    bin += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(bin);
}
