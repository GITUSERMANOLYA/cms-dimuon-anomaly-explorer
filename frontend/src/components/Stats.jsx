// Statistics tab: correlation / covariance, PCA scatter, 2-D histogram, global SHAP importance.
import { useMemo, useState } from "react";
import { api, useApi } from "../api.js";

// Correlation in [-1, 1] -> colour: blue = negative, red = positive.
const corrColour = (v) =>
  v >= 0 ? `rgba(229,72,77,${Math.min(v, 1)})` : `rgba(59,111,212,${Math.min(-v, 1)})`;

/* ---------- correlation / covariance ---------- */
function CorrCard() {
  const [view, setView] = useState("pearson"); // pearson | spearman | cov
  const { data, error } = useApi(
    () => (view === "cov" ? api.cov() : api.corr(view)),
    [view]
  );

  return (
    <div className="card">
      <h2>Correlation</h2>
      <div className="chips" style={{ marginBottom: 10 }}>
        {[["pearson", "Pearson"], ["spearman", "Spearman"], ["cov", "Covariance"]].map(([id, label]) => (
          <button key={id} className={"chip" + (view === id ? " on" : "")} onClick={() => setView(id)}>{label}</button>
        ))}
      </div>
      {error && <div className="error">{error}</div>}
      {data ? (
        <div className="scroll">
          <table className="data" style={{ minWidth: 0 }}>
            <thead>
              <tr><th></th>{data.cols.map((n) => <th key={n}>{n}</th>)}</tr>
            </thead>
            <tbody>
              {data.matrix.map((row, i) => (
                <tr key={data.cols[i]}>
                  <th>{data.cols[i]}</th>
                  {row.map((v, j) => (
                    <td key={j} style={{ textAlign: "center", background: view === "cov" ? "transparent" : corrColour(v) }}>
                      {view === "cov" ? v.toPrecision(3) : v.toFixed(2)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="loading">Loading...</div>
      )}
      {view !== "cov" && <p className="muted">Red = positive, blue = negative. Spearman is rank-based, so it ignores outliers.</p>}
    </div>
  );
}

/* ---------- PCA scatter ---------- */
function PcaCard() {
  const { data, error } = useApi(() => api.pca(), []);
  const W = 560, H = 300, P = 24;

  const geo = useMemo(() => {
    if (!data) return null;
    const xs = data.points.map((p) => p[0]), ys = data.points.map((p) => p[1]);
    const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
    return {
      sx: (v) => P + ((v - x0) / (x1 - x0 || 1)) * (W - 2 * P),
      sy: (v) => H - P - ((v - y0) / (y1 - y0 || 1)) * (H - 2 * P),
    };
  }, [data]);

  return (
    <div className="card">
      <h2>PCA (PC1 vs PC2)</h2>
      {error && <div className="error">{error}</div>}
      {data && geo ? (
        <>
          <svg className="chart" viewBox={`0 0 ${W} ${H}`} width="100%">
            <line className="axis" x1={P} y1={H - P} x2={W - P} y2={H - P} />
            <line className="axis" x1={P} y1={P} x2={P} y2={H - P} />
            {data.points.map((p, i) => !data.flagged[i] && (
              <circle key={i} cx={geo.sx(p[0])} cy={geo.sy(p[1])} r="1.6" className="dot" />
            ))}
            {data.points.map((p, i) => data.flagged[i] && (
              <circle key={"f" + i} cx={geo.sx(p[0])} cy={geo.sy(p[1])} r="2.2" className="flag" />
            ))}
            <text x={W / 2} y={H - 6} textAnchor="middle">PC1 ({(data.explained[0] * 100).toFixed(1)}%)</text>
            <text x={12} y={H / 2} textAnchor="middle" transform={`rotate(-90 12 ${H / 2})`}>
              PC2 ({(data.explained[1] * 100).toFixed(1)}%)
            </text>
          </svg>
          <p className="muted">
            Grey = random sample of normal events, red = top 1% flagged. Explained variance:{" "}
            {data.explained.map((e) => (e * 100).toFixed(1) + "%").join(", ")}.
          </p>
        </>
      ) : (
        !error && <div className="loading">Loading...</div>
      )}
    </div>
  );
}

/* ---------- 2-D histogram ---------- */
function Hist2dCard({ features }) {
  const [x, setX] = useState("pt1");
  const [y, setY] = useState("pt2");
  const { data, error } = useApi(() => api.hist2d(x, y, 50), [x, y]);
  const W = 560, H = 300, P = 48; // P is wide enough for tick labels like 198.895

  const cells = useMemo(() => {
    if (!data) return null;
    const max = Math.max(...data.counts.flat(), 1);
    const nx = data.counts.length, ny = data.counts[0].length;
    const cw = (W - 2 * P) / nx, ch = (H - 2 * P) / ny;
    const out = [];
    data.counts.forEach((row, i) =>
      row.forEach((c, j) => {
        if (c > 0)
          out.push(
            <rect key={i + "-" + j} x={P + i * cw} y={H - P - (j + 1) * ch} width={cw + 0.3} height={ch + 0.3}
              className="bar" style={{ opacity: 0.12 + 0.88 * (Math.log1p(c) / Math.log1p(max)) }} />
          );
      })
    );
    return out;
  }, [data]);

  return (
    <div className="card">
      <h2>2-D histogram</h2>
      <div className="controls" style={{ marginBottom: 8 }}>
        <label>X
          <select value={x} onChange={(e) => setX(e.target.value)}>{features.map((f) => <option key={f}>{f}</option>)}</select>
        </label>
        <label>Y
          <select value={y} onChange={(e) => setY(e.target.value)}>{features.map((f) => <option key={f}>{f}</option>)}</select>
        </label>
      </div>
      {error && <div className="error">{error}</div>}
      {data && cells ? (
        <svg className="chart" viewBox={`0 0 ${W} ${H}`} width="100%">
          <line className="axis" x1={P} y1={H - P} x2={W - P} y2={H - P} />
          <line className="axis" x1={P} y1={P} x2={P} y2={H - P} />
          {cells}
          <text x={P} y={H - 12} textAnchor="start">{data.xedges[0]}</text>
          <text x={W - P} y={H - 12} textAnchor="end">{data.xedges[data.xedges.length - 1]}</text>
          <text x={W / 2} y={H - 4} textAnchor="middle">{x}</text>
          <text x={P - 4} y={H - P} textAnchor="end">{data.yedges[0]}</text>
          <text x={P - 4} y={P + 8} textAnchor="end">{data.yedges[data.yedges.length - 1]}</text>
          <text x={10} y={H / 2} textAnchor="middle" transform={`rotate(-90 10 ${H / 2})`}>{y}</text>
        </svg>
      ) : (
        !error && <div className="loading">Loading...</div>
      )}
      <p className="muted">Stronger colour = more events (log scale, so sparse regions stay visible). Pt columns are heavy-tailed, so most events sit near the origin.</p>
    </div>
  );
}

/* ---------- global SHAP ---------- */
function ShapCard() {
  const { data, error } = useApi(() => api.shapGlobal(), []);
  const max = data ? Math.max(...data.mean_abs, 1e-9) : 1;

  return (
    <div className="card">
      <h2>What drives the anomaly score (SHAP)</h2>
      {error && <div className="error">{error}</div>}
      {data ? (
        data.cols
          .map((c, i) => [c, data.mean_abs[i]])
          .sort((a, b) => b[1] - a[1])
          .map(([c, v]) => (
            <div className="barrow" key={c}>
              <span>{c}</span>
              <div><i style={{ width: `${(v / max) * 100}%` }} /></div>
              <b>{v.toFixed(3)}</b>
            </div>
          ))
      ) : (
        !error && <div className="loading">Computing SHAP values (first load can take a while)...</div>
      )}
      <p className="muted">Mean |SHAP| over the top 1000 flagged events. IsolationForest component only.</p>
    </div>
  );
}

export default function Stats() {
  const summary = useApi(() => api.summary(), []);
  const features = summary.data?.features || ["pt1", "pt2", "eta1", "eta2", "dphi", "deta", "mass"];

  return (
    <>
      <div className="grid2">
        <CorrCard />
        <PcaCard />
      </div>
      <div className="grid2">
        <Hist2dCard features={features} />
        <ShapCard />
      </div>
    </>
  );
}
