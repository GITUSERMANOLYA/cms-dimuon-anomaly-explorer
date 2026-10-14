"""CMS dimuon engine: cleaning, features, ensemble anomaly scores,
column-wise flags, statistics and SHAP explanations."""
import os
from pathlib import Path
import numpy as np
import pandas as pd
from scipy.optimize import curve_fit
from scipy.stats import rankdata
from sklearn.covariance import MinCovDet
from sklearn.decomposition import PCA
from sklearn.ensemble import IsolationForest
from sklearn.neighbors import LocalOutlierFactor
from sklearn.preprocessing import RobustScaler

ROOT = Path(__file__).resolve().parent.parent
CSV = Path(os.environ.get("CMS_CSV", ROOT / "data" / "Dimuon_DoubleMu.csv"))
CACHE = ROOT / "data" / "scores_cache.npz"
FEATURES = ["pt1", "pt2", "eta1", "eta2", "dphi", "deta", "mass"]
LOGCOLS = ["pt1", "pt2", "mass"]  # heavy-tailed: modelled on log1p scale
RES = {"J/psi": (3.1, 2.8, 3.4), "Upsilon": (9.46, 8.8, 10.8), "Z": (91.2, 80.0, 102.0)}
r4 = lambda a: np.round(np.asarray(a, dtype=float), 4).tolist()


def clean(path=CSV):
    df = pd.read_csv(path)
    log = {"input_rows": len(df)}
    df = df.dropna().drop_duplicates(["Run", "Event"])
    E, px, py, pz = df.E1 + df.E2, df.px1 + df.px2, df.py1 + df.py2, df.pz1 + df.pz2
    m2 = E**2 - px**2 - py**2 - pz**2
    df = df.assign(mass=np.sqrt(m2.clip(lower=0)))
    n = len(df); df = df[m2.loc[df.index] >= 0]; log["negative_M2"] = n - len(df)
    n = len(df); df = df[(df.mass - df.M).abs() <= 0.1]; log["mass_mismatch"] = n - len(df)
    n = len(df)
    for i in "12":
        rel = (np.hypot(df[f"px{i}"], df[f"py{i}"]) - df[f"pt{i}"]).abs() / df[f"pt{i}"]
        df = df[rel <= 0.2]
    log["pt_inconsistent"] = n - len(df)
    dphi = (df.phi1 - df.phi2).abs()
    df = df.assign(dphi=np.where(dphi > np.pi, 2 * np.pi - dphi, dphi), deta=(df.eta1 - df.eta2).abs())
    log["clean_rows"] = len(df)
    return df.reset_index(drop=True), log


def quantile_z(T):
    """Distribution-free z: rank -> normal quantile. |z|=3 means a tail of about 0.27% on a
    column, whatever its shape (works for skewed / two-humped columns where MAD fails)."""
    from scipy.stats import norm
    return T.rank().sub(0.5).div(len(T)).apply(norm.ppf)


class Engine:
    def __init__(self):
        self.df, self.cleaning = clean()
        self.n = len(self.df)
        T = self.df[FEATURES].copy()
        T[LOGCOLS] = np.log1p(T[LOGCOLS])
        self.T, self.Z = T, quantile_z(T)          # model scale, quantile z-scores
        self.X = RobustScaler().fit_transform(T)
        self.iso = IsolationForest(n_estimators=200, random_state=42, n_jobs=-1).fit(self.X)
        s_if = -self.iso.score_samples(self.X)
        if CACHE.exists() and np.load(CACHE)["lof"].shape[0] == self.n:
            c = np.load(CACHE); s_lof, s_mah = c["lof"], c["mah"]
        else:
            s_lof = -LocalOutlierFactor(n_neighbors=35, n_jobs=-1).fit(self.X).negative_outlier_factor_
            sub = np.random.default_rng(42).choice(self.n, min(20000, self.n), replace=False)
            s_mah = MinCovDet(random_state=42).fit(self.X[sub]).mahalanobis(self.X)
            np.savez(CACHE, lof=s_lof, mah=s_mah)
        rk = lambda s: rankdata(s) / self.n
        self.scores = {"iforest": s_if, "lof": s_lof, "mahalanobis": s_mah}
        self.ens = (rk(s_if) + rk(s_lof) + rk(s_mah)) / 3   # rank-averaged ensemble in [0,1]
        self.B_cache = {}
        self._shap = None

    # ---- helpers
    def thr_score(self, pct): return np.quantile(self.ens, 1 - pct / 100)

    def row(self, i, cols=None):
        d = self.df.iloc[i]
        out = {"idx": int(i), "Run": int(d.Run), "Event": int(d.Event), "ensemble": round(float(self.ens[i]), 4)}
        out.update({c: round(float(d[c]), 3) for c in FEATURES})
        out["z"] = {c: round(float(self.Z.iloc[i][c]), 2) for c in (cols or FEATURES)}
        return out

    def anomalies(self, pct=1.0, limit=100, min_pt=0.0, m_lo=0.0, m_hi=300.0):
        d = self.df
        mask = (self.ens >= self.thr_score(pct)) & (np.maximum(d.pt1, d.pt2) >= min_pt) & d.mass.between(m_lo, m_hi)
        idx = np.where(mask)[0]; idx = idx[np.argsort(-self.ens[idx])]
        return {"matched": int(len(idx)), "rows": [self.row(i) for i in idx[:limit]]}

    # ---- column-wise anomalies
    def flags(self, thr):
        if thr not in self.B_cache: self.B_cache[thr] = (self.Z.abs() > thr).to_numpy()
        return self.B_cache[thr]

    def combos(self, thr=3.0):
        B = self.flags(thr); key = B @ (1 << np.arange(len(FEATURES)))
        u, c = np.unique(key[key > 0], return_counts=True)
        out = [{"cols": [f for j, f in enumerate(FEATURES) if k >> j & 1], "n": int(n)} for k, n in zip(u, c)]
        return sorted(out, key=lambda x: -x["n"])

    def column_query(self, cols, mode="exact", thr=3.0, limit=100, pct=1.0):
        ix = [FEATURES.index(c) for c in cols]; rest = [j for j in range(len(FEATURES)) if j not in ix]
        if mode == "model":   # IsolationForest refit on exactly the chosen columns
            Xs = self.X[:, ix]; m = IsolationForest(n_estimators=150, contamination=pct / 100, random_state=42, n_jobs=-1).fit(Xs)
            sc = -m.score_samples(Xs); mask = m.predict(Xs) == -1
        else:
            B = self.flags(thr)
            mask = B[:, ix].all(1) & ~B[:, rest].any(1) if mode == "exact" else B[:, ix].any(1)
            sc = self.Z.iloc[:, ix].abs().max(axis=1).to_numpy()
        idx = np.where(mask)[0]; idx = idx[np.argsort(-sc[idx])]
        return {"mode": mode, "cols": cols, "matched": int(len(idx)), "rows": [self.row(i, cols) for i in idx[:limit]]}

    # ---- statistics
    def corr(self, method="pearson"): return {"cols": FEATURES, "matrix": r4(self.df[FEATURES].corr(method=method))}
    def cov(self): return {"cols": FEATURES, "matrix": r4(self.df[FEATURES].cov())}

    def pca(self, k=3, sample=4000):
        p = PCA(n_components=k, random_state=42).fit(self.X); P = p.transform(self.X)
        top = np.argsort(-self.ens)[:int(self.n * 0.01)]
        rest = np.random.default_rng(1).choice(np.setdiff1d(np.arange(self.n), top), sample, replace=False)
        idx = np.concatenate([rest, top])
        return {"explained": r4(p.explained_variance_ratio_), "loadings": r4(p.components_), "cols": FEATURES,
                "points": r4(P[idx]), "ensemble": r4(self.ens[idx]), "flagged": [bool(i in set(top)) for i in idx]}

    def hist2d(self, x, y, bins=60):
        H, xe, ye = np.histogram2d(self.df[x], self.df[y], bins=bins)
        return {"x": x, "y": y, "counts": H.astype(int).tolist(), "xedges": r4(xe), "yedges": r4(ye)}

    def massdist(self, pct=1.0, bins=80):
        e = np.logspace(np.log10(0.3), np.log10(300), bins + 1); m = self.df.mass
        fl = m[self.ens >= self.thr_score(pct)]
        return {"edges": r4(e), "all": np.histogram(m, e)[0].tolist(), "flagged": np.histogram(fl, e)[0].tolist()}

    def peaks(self):
        g = lambda x, A, mu, s, a, b: A * np.exp(-(x - mu) ** 2 / (2 * s**2)) + a + b * x
        out = {}
        for name, (c, lo, hi) in RES.items():
            h, e = np.histogram(self.df.mass, bins=60, range=(lo, hi)); x = (e[:-1] + e[1:]) / 2
            try:
                p, cv = curve_fit(g, x, h, p0=[h.max() - h.min(), c, (hi - lo) / 8, h.min(), 0], maxfev=20000)
                er = np.sqrt(np.diag(cv))
                out[name] = {"mean": round(p[1], 3), "mean_err": round(er[1], 3), "sigma": round(abs(p[2]), 3),
                             "signal_events": int(p[0] * abs(p[2]) * np.sqrt(2 * np.pi) / (x[1] - x[0]))}
            except Exception as ex:
                out[name] = {"error": str(ex)}
        return out

    # ---- explainability (SHAP on the IsolationForest component only)
    def shap(self, top=1000):
        if self._shap is None:
            import shap
            idx = np.argsort(-self.ens)[:top]
            sv = -shap.TreeExplainer(self.iso).shap_values(self.X[idx])   # sign flipped: + = pushes toward anomalous
            self._shap = (idx, sv)
        return self._shap

    def explain(self, i):
        out = self.row(int(i)); idx, sv = self.shap()
        w = np.where(idx == i)[0]
        out["shap"] = {c: round(float(v), 4) for c, v in zip(FEATURES, sv[w[0]])} if len(w) else None
        out["known_resonance"] = next((n for n, (_, lo, hi) in RES.items() if lo <= out["mass"] <= hi), None)
        return out

    def shap_global(self):
        _, sv = self.shap(); return {"cols": FEATURES, "mean_abs": r4(np.abs(sv).mean(0))}
