// Column explorer tab: find events that are unusual in specific columns.
//   exact = flagged in these columns and no others
//   any   = flagged in at least one of these columns
//   model = IsolationForest refit on only the chosen columns
import { useState } from "react";
import { api, useApi } from "../api.js";
import EventTable from "./EventTable.jsx";

export default function ColumnExplorer({ onSelect, selected }) {
  const [cols, setCols] = useState(["pt1"]);
  const [mode, setMode] = useState("exact");
  const [thr, setThr] = useState(3);
  const [pct, setPct] = useState(1);
  const [limit, setLimit] = useState(100);

  const summary = useApi(() => api.summary(), []);
  const combos = useApi(() => api.combos(thr), [thr]);
  const q = useApi(
    () =>
      cols.length
        ? api.columnQuery({ cols: cols.join(","), mode, thr, limit, pct })
        : Promise.resolve(null),
    [cols.join(","), mode, thr, limit, pct]
  );

  const features = summary.data?.features || [];
  const toggle = (f) => setCols((cur) => (cur.includes(f) ? cur.filter((x) => x !== f) : [...cur, f]));

  // Table shows the z-score of every selected column, plus mass and the ensemble score.
  const columns = [
    ...cols.map((c) => [`z(${c})`, (r) => r.z?.[c]]),
    ["mass", (r) => r.mass],
    ["Run", (r) => r.Run],
    ["Event", (r) => r.Event],
    ["score", (r) => r.ensemble],
  ];

  return (
    <>
      <div className="card">
        <h2>1. Pick columns</h2>
        <div className="chips">
          {features.map((f) => (
            <button key={f} className={"chip" + (cols.includes(f) ? " on" : "")} onClick={() => toggle(f)}>
              {f}
            </button>
          ))}
        </div>

        <h2 style={{ marginTop: 14 }}>2. Pick how to match</h2>
        <div className="controls">
          <label>Mode
            <select value={mode} onChange={(e) => setMode(e.target.value)}>
              <option value="exact">exact (only these columns)</option>
              <option value="any">any (at least one)</option>
              <option value="model">model (refit forest)</option>
            </select>
          </label>
          {mode === "model" ? (
            <label>Top % flagged
              <input type="number" min="0.1" max="10" step="0.1" value={pct}
                onChange={(e) => setPct(Number(e.target.value) || 1)} />
            </label>
          ) : (
            <label>|z| threshold
              <input type="number" min="1" max="6" step="0.5" value={thr}
                onChange={(e) => setThr(Number(e.target.value) || 3)} />
            </label>
          )}
          <label>Rows
            <select value={limit} onChange={(e) => setLimit(Number(e.target.value))}>
              {[50, 100, 200, 500].map((n) => <option key={n}>{n}</option>)}
            </select>
          </label>
        </div>
        <p className="muted">
          z is a rank-based score: |z| = 3 means roughly the most extreme 0.27% of that column.
        </p>
      </div>

      <div className="card">
        <h2>Common combinations at |z| &gt; {thr}</h2>
        {combos.error && <div className="error">{combos.error}</div>}
        {combos.data ? (
          <div className="chips">
            {combos.data.combos.slice(0, 14).map((c) => (
              <button key={c.cols.join("+")} className="chip"
                onClick={() => { setCols(c.cols); setMode("exact"); }}>
                {c.cols.join(" + ")} · {c.n.toLocaleString()}
              </button>
            ))}
          </div>
        ) : (
          <div className="loading">Loading...</div>
        )}
        <p className="muted">Click one to load its events below (sets mode to exact).</p>
      </div>

      <div className="card">
        <h2>Matching events</h2>
        {!cols.length && <div className="loading">Select at least one column.</div>}
        {q.error && <div className="error">{q.error}</div>}
        {cols.length > 0 && q.data && (
          <>
            <EventTable rows={q.data.rows} columns={columns} onSelect={onSelect} selected={selected} />
            <p className="muted">
              Showing {q.data.rows.length} of {q.data.matched.toLocaleString()} matches. Click a row for details.
            </p>
          </>
        )}
        {cols.length > 0 && q.loading && !q.data && <div className="loading">Loading...</div>}
      </div>
    </>
  );
}
