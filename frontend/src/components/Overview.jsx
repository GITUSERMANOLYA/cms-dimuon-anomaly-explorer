// Overview tab: KPI tiles, mass spectrum with flagged events overlaid, peak fits, and the review table.
import { useState } from "react";
import { api, useApi } from "../api.js";
import Histogram from "./Histogram.jsx";
import EventTable from "./EventTable.jsx";

const COLUMNS = [
  ["score", (r) => r.ensemble],
  ["Run", (r) => r.Run],
  ["Event", (r) => r.Event],
  ["pt1", (r) => r.pt1],
  ["pt2", (r) => r.pt2],
  ["eta1", (r) => r.eta1],
  ["eta2", (r) => r.eta2],
  ["mass", (r) => r.mass],
];

export default function Overview({ onSelect, selected }) {
  // Filters are sent straight to the backend, which does the real filtering.
  const [pct, setPct] = useState(1);        // flag the top pct % of ensemble scores
  const [minPt, setMinPt] = useState(0);    // min of the larger muon pT
  const [mLo, setMLo] = useState(0);
  const [mHi, setMHi] = useState(300);
  const [limit, setLimit] = useState(100);

  const summary = useApi(() => api.summary(), []);
  const mass = useApi(() => api.massdist(pct), [pct]);
  const peaks = useApi(() => api.peaks(), []);
  const an = useApi(
    () => api.anomalies({ pct, limit, min_pt: minPt, m_lo: mLo, m_hi: mHi }),
    [pct, limit, minPt, mLo, mHi]
  );

  const c = summary.data?.cleaning;
  const tiles = [
    ["Raw rows", c?.input_rows],
    ["Clean rows", c?.clean_rows],
    ["Flag threshold", `top ${pct}%`],
    ["Matching filters", an.data?.matched],
  ];

  return (
    <>
      <div className="kpis">
        {tiles.map(([label, v]) => (
          <div className="kpi" key={label}>
            <b>{v === undefined ? "-" : typeof v === "number" ? v.toLocaleString() : v}</b>
            <span>{label}</span>
          </div>
        ))}
      </div>

      <div className="grid2">
        <div className="card">
          <h2>Dimuon invariant mass spectrum (log scale)</h2>
          {mass.error && <div className="error">{mass.error}</div>}
          {mass.data ? (
            <Histogram edges={mass.data.edges} counts={mass.data.all} flagged={mass.data.flagged}
              logX xLabel="invariant mass (GeV)" />
          ) : (
            <div className="loading">Loading...</div>
          )}
          <p className="muted">Blue = all events, red = flagged by the ensemble.</p>
        </div>

        <div className="card">
          <h2>Resonance peak fits</h2>
          {peaks.error && <div className="error">{peaks.error}</div>}
          {peaks.data ? (
            <table className="data" style={{ minWidth: 0 }}>
              <thead>
                <tr><th>peak</th><th>mean (GeV)</th><th>sigma</th><th>signal events</th></tr>
              </thead>
              <tbody>
                {Object.entries(peaks.data).map(([name, p]) => (
                  <tr key={name}>
                    <td>{name}</td>
                    {p.error ? (
                      <td colSpan={3} className="error">fit failed</td>
                    ) : (
                      <>
                        <td>{p.mean} ± {p.mean_err < 0.001 ? "<0.001" : p.mean_err}</td>
                        <td>{p.sigma}</td>
                        <td>{p.signal_events.toLocaleString()}</td>
                      </>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="loading">Loading...</div>
          )}
          <p className="muted">Gaussian + linear background fit per resonance. Compare with the known masses.</p>
        </div>
      </div>

      <div className="card">
        <h2>Review table: top anomalies</h2>
        <div className="controls" style={{ marginBottom: 10 }}>
          <label>Top % flagged
            <input type="number" min="0.1" max="10" step="0.1" value={pct}
              onChange={(e) => setPct(Number(e.target.value) || 1)} />
          </label>
          <label>Min pT (GeV)
            <input type="number" min="0" value={minPt} onChange={(e) => setMinPt(Number(e.target.value) || 0)} />
          </label>
          <label>Mass from
            <input type="number" min="0" value={mLo} onChange={(e) => setMLo(Number(e.target.value) || 0)} />
          </label>
          <label>Mass to
            <input type="number" min="0" value={mHi} onChange={(e) => setMHi(Number(e.target.value) || 300)} />
          </label>
          <label>Rows
            <select value={limit} onChange={(e) => setLimit(Number(e.target.value))}>
              {[25, 50, 100, 200, 500].map((n) => <option key={n}>{n}</option>)}
            </select>
          </label>
        </div>

        {an.error && <div className="error">{an.error}</div>}
        {an.data ? (
          <>
            <EventTable rows={an.data.rows} columns={COLUMNS} onSelect={onSelect} selected={selected} />
            <p className="muted">
              Showing {an.data.rows.length} of {an.data.matched.toLocaleString()} matching events. Click a row for details.
            </p>
          </>
        ) : (
          <div className="loading">Loading...</div>
        )}
      </div>
    </>
  );
}
