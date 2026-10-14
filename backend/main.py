"""FastAPI app. Run: uvicorn main:app --port 8000   (from the backend folder)"""
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from core import Engine, FEATURES

app = FastAPI(title="CMS dimuon anomaly API")
app.add_middleware(CORSMiddleware, allow_origins=["http://localhost:5173"], allow_methods=["*"], allow_headers=["*"])
E = Engine()


def cols_of(s):
    c = [x for x in s.split(",") if x]
    if not c or any(x not in FEATURES for x in c): raise HTTPException(400, f"cols must be from {FEATURES}")
    return c


@app.get("/api/summary")
def summary(): return {"cleaning": E.cleaning, "features": FEATURES, "models": ["IsolationForest", "LOF", "Mahalanobis (MinCovDet)"]}

@app.get("/api/anomalies")
def anomalies(pct: float = 1.0, limit: int = 100, min_pt: float = 0, m_lo: float = 0, m_hi: float = 300):
    return E.anomalies(pct, limit, min_pt, m_lo, m_hi)

@app.get("/api/columns/combos")
def combos(thr: float = 3.0): return {"thr": thr, "combos": E.combos(thr)}

@app.get("/api/columns/query")
def column_query(cols: str, mode: str = "exact", thr: float = 3.0, limit: int = 100, pct: float = 1.0):
    if mode not in ("exact", "any", "model"): raise HTTPException(400, "mode: exact | any | model")
    return E.column_query(cols_of(cols), mode, thr, limit, pct)

@app.get("/api/stats/corr")
def corr(method: str = "pearson"): return E.corr(method)

@app.get("/api/stats/cov")
def cov(): return E.cov()

@app.get("/api/stats/pca")
def pca(): return E.pca()

@app.get("/api/stats/hist2d")
def hist2d(x: str, y: str, bins: int = 60): return E.hist2d(cols_of(x)[0], cols_of(y)[0], min(bins, 120))

@app.get("/api/stats/massdist")
def massdist(pct: float = 1.0): return E.massdist(pct)

@app.get("/api/stats/peaks")
def peaks(): return E.peaks()

@app.get("/api/event/{idx}")
def event(idx: int):
    if not 0 <= idx < E.n: raise HTTPException(404, "no such event")
    return E.explain(idx)

@app.get("/api/shap/global")
def shap_global(): return E.shap_global()
