/* Engine worker: loads Pyodide + the planner_app package and serves compute
   and export requests. All heavy work stays off the UI thread.

   Shipped as a Blob worker (client.ts bundles this file via ?raw), so it may
   not use any relative URL: the first message must be {cmd:"init"} carrying
   either an absolute zipUrl (live app) or zipBytes (exported single-file
   app). Pyodide itself always loads from its CDN by absolute URL. */

importScripts("https://cdn.jsdelivr.net/pyodide/v0.26.4/full/pyodide.js");

let openpyxlLoaded = false;

let resolveInit;
const initArgs = new Promise((resolve) => {
  resolveInit = resolve;
});

const ready = (async () => {
  const [init, pyodide] = await Promise.all([
    initArgs,
    loadPyodide({ indexURL: "https://cdn.jsdelivr.net/pyodide/v0.26.4/full/" }),
  ]);
  self.pyodide = pyodide;
  let buf = init.zipBytes;
  if (!buf) {
    const resp = await fetch(init.zipUrl, { cache: "no-cache" });
    if (!resp.ok) throw new Error("planner_app.zip fetch failed: " + resp.status);
    buf = await resp.arrayBuffer();
  }
  self.pyodide.unpackArchive(buf, "zip");
  // The legacy engine module chain imports sqlite3, which Pyodide unvendors.
  await self.pyodide.loadPackage("sqlite3");
  await self.pyodide.runPythonAsync(
    "import sys\n" +
      "if '' not in sys.path: sys.path.insert(0, '')\n" +
      "from planner_app.api import compute_json, bootstrap_json\n"
  );
  self.computeJson = self.pyodide.globals.get("compute_json");
  return true;
})();

async function ensureOpenpyxl() {
  if (openpyxlLoaded) return;
  await self.pyodide.loadPackage("micropip");
  await self.pyodide.runPythonAsync(
    "import micropip\nawait micropip.install('openpyxl')"
  );
  await self.pyodide.runPythonAsync(
    "from planner_app.exporters_v2 import export_advisor_xlsx_b64"
  );
  self.exportXlsxB64 = self.pyodide.globals.get("export_advisor_xlsx_b64");
  openpyxlLoaded = true;
}

self.onmessage = async (event) => {
  const { id, cmd, arg } = event.data;
  if (cmd === "init") {
    resolveInit(event.data);
    return;
  }
  try {
    await ready;
    let result;
    if (cmd === "ping") {
      result = "ready";
    } else if (cmd === "compute") {
      result = self.computeJson(arg);
    } else if (cmd === "export_xlsx") {
      await ensureOpenpyxl();
      result = self.exportXlsxB64(arg);
    } else {
      throw new Error("Unknown command: " + cmd);
    }
    self.postMessage({ id, ok: true, result });
  } catch (error) {
    self.postMessage({ id, ok: false, error: String(error) });
  }
};
