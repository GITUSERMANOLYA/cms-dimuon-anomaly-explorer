// All backend calls live here. Each function matches one route in backend/main.py.
import { useEffect, useState } from "react";

const BASE = "/api"; // Vite proxies this to http://localhost:8000 (see vite.config.js)

async function get(path, params = {}) {
  // Drop empty params so the URL stays clean (0 is kept, "" is dropped).
  const qs = new URLSearchParams(
    Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== "")
  ).toString();
  const res = await fetch(`${BASE}${path}${qs ? "?" + qs : ""}`);
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return res.json();
}

export const api = {
  summary: () => get("/summary"),                         // {cleaning, features, models}
  anomalies: (p) => get("/anomalies", p),                 // {matched, rows}   p: pct, limit, min_pt, m_lo, m_hi
  combos: (thr) => get("/columns/combos", { thr }),       // {thr, combos:[{cols, n}]}
  columnQuery: (p) => get("/columns/query", p),           // {mode, cols, matched, rows}  p: cols, mode, thr, limit, pct
  corr: (method) => get("/stats/corr", { method }),       // {cols, matrix}
  cov: () => get("/stats/cov"),                           // {cols, matrix}
  pca: () => get("/stats/pca"),                           // {explained, loadings, cols, points, ensemble, flagged}
  hist2d: (x, y, bins) => get("/stats/hist2d", { x, y, bins }), // {x, y, counts, xedges, yedges}
  massdist: (pct) => get("/stats/massdist", { pct }),     // {edges, all, flagged}
  peaks: () => get("/stats/peaks"),                       // {"J/psi": {mean, mean_err, sigma, signal_events}, ...}
  event: (idx) => get(`/event/${idx}`),                   // row + {shap, known_resonance}
  shapGlobal: () => get("/shap/global"),                  // {cols, mean_abs}
};

// Small data-fetching hook. Re-runs whenever `deps` change.
// The `cancelled` flag stops a stale response from overwriting newer state
// (it also keeps React StrictMode's double-run harmless).
export function useApi(fn, deps) {
  const [state, setState] = useState({ data: null, error: null, loading: true });

  useEffect(() => {
    let cancelled = false;
    setState((s) => ({ ...s, loading: true, error: null }));
    fn()
      .then((data) => !cancelled && setState({ data, error: null, loading: false }))
      .catch((e) => !cancelled && setState({ data: null, error: e.message, loading: false }));
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return state;
}
