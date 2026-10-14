// Top-level layout: header, three tabs, and a shared "selected event" panel.
import { useState } from "react";
import { api, useApi } from "./api.js";
import Overview from "./components/Overview.jsx";
import ColumnExplorer from "./components/ColumnExplorer.jsx";
import Stats from "./components/Stats.jsx";
import EventPanel from "./components/EventPanel.jsx";

const TABS = [
  ["overview", "Overview"],
  ["columns", "Column explorer"],
  ["stats", "Statistics"],
];

export default function App() {
  const [tab, setTab] = useState("overview");
  // The event the user clicked in any table. Held here so the same panel works on every tab.
  const [selected, setSelected] = useState(null);
  const { data: summary, error } = useApi(() => api.summary(), []);

  const c = summary?.cleaning;
  const subtitle = c
    ? `${c.clean_rows.toLocaleString()} events after cleaning (${(c.input_rows - c.clean_rows).toLocaleString()} removed)`
    : "Loading...";

  return (
    <div className="page">
      <div className="topbar">
        <h1>CMS dimuon anomaly explorer</h1>
        <p>
          {subtitle} · CMS 2011 Open Data (education subset). Flags are statistical,
          not discoveries.
        </p>
      </div>

      {error && (
        <div className="card error">
          Cannot reach the backend. Start it with <code>uvicorn main:app --port 8000</code>{" "}
          inside the backend folder. ({error})
        </div>
      )}

      <div className="tabs">
        {TABS.map(([id, label]) => (
          <button key={id} className={tab === id ? "active" : ""} onClick={() => setTab(id)}>
            {label}
          </button>
        ))}
      </div>

      {tab === "overview" && <Overview onSelect={setSelected} selected={selected} />}
      {tab === "columns" && <ColumnExplorer onSelect={setSelected} selected={selected} />}
      {tab === "stats" && <Stats />}

      {selected !== null && <EventPanel idx={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}
