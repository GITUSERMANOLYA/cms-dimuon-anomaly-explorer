// Detail panel for the clicked event. Sticks to the bottom of the page on every tab.
import { api, useApi } from "../api.js";

const FEATURES = ["pt1", "pt2", "eta1", "eta2", "dphi", "deta", "mass"];

export default function EventPanel({ idx, onClose }) {
  const res = useApi(() => api.event(idx), [idx]);
  const { error, loading } = res;
  // useApi keeps the previous result while a new one loads, so ignore data that belongs to another event.
  const data = res.data && res.data.idx === idx ? res.data : null;

  // SHAP bars: width = size of the push, red = toward anomalous, blue = toward normal.
  const shap = data?.shap;
  const maxShap = shap ? Math.max(...Object.values(shap).map(Math.abs), 1e-9) : 1;

  return (
    <div className="card panel">
      <div className="head">
        <h2>
          Event #{idx}
          {data && <span className="muted"> · Run {data.Run} · Event {data.Event} · score {data.ensemble}</span>}
        </h2>
        <button onClick={onClose}>Close</button>
      </div>

      {error && <div className="error">{error}</div>}
      {loading && !data && <div className="loading">Loading...</div>}

      {data && (
        <div className="grid2">
          <div>
            {data.known_resonance && (
              <p><span className="tag">near {data.known_resonance}</span>
                <span className="muted"> mass sits in a known resonance window, so this is probably not new physics.</span></p>
            )}
            <div className="kv">
              {FEATURES.map((f) => (
                <div key={f}>
                  <span>{f}</span>
                  <b>{data[f]} <small className="muted">z {data.z?.[f] ?? "-"}</small></b>
                </div>
              ))}
            </div>
          </div>

          <div>
            <h2>Why was it flagged?</h2>
            {shap ? (
              FEATURES.map((f) => (
                <div className="barrow" key={f}>
                  <span>{f}</span>
                  <div>
                    <i className={shap[f] >= 0 ? "pos" : "neg"} style={{ width: `${(Math.abs(shap[f]) / maxShap) * 100}%` }} />
                  </div>
                  <b>{shap[f].toFixed(3)}</b>
                </div>
              ))
            ) : (
              <p className="muted">SHAP explanations are computed only for the top 1000 events by ensemble score.</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
