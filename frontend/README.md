# CMS dimuon anomaly explorer - frontend

React + Vite. Talks to the FastAPI backend through a dev proxy (`/api` -> `localhost:8000`).

## Project layout

```
project/
  backend/    core.py, main.py, requirements.txt
  data/       Dimuon_DoubleMu.csv   (core.py reads ../data relative to backend/)
  frontend/   <- this folder
```

## Run

Terminal 1 (backend):

```
cd backend
pip install -r requirements.txt
uvicorn main:app --port 8000
```

Terminal 2 (frontend):

```
cd frontend
npm install
npm run dev
```

Open http://localhost:5173. The first start of the backend takes a while (it fits the models and caches LOF scores in `data/scores_cache.npz`).

## Files

| File | Job |
|---|---|
| `src/main.jsx` | Mounts `<App />` into `#root` |
| `src/App.jsx` | Header, tabs, shared "selected event" state |
| `src/api.js` | One function per backend route, plus the `useApi` hook |
| `src/components/Overview.jsx` | KPIs, mass spectrum, peak fits, anomaly table |
| `src/components/ColumnExplorer.jsx` | Column-wise anomaly search (exact / any / model) |
| `src/components/Stats.jsx` | Correlation, PCA, 2-D histogram, global SHAP |
| `src/components/EventPanel.jsx` | Detail + SHAP explanation for the clicked event |
| `src/components/Histogram.jsx` | SVG histogram (linear or log x-axis) |
| `src/components/EventTable.jsx` | Shared clickable table |
| `src/styles.css` | All styling; colours are CSS variables (auto dark mode) |
