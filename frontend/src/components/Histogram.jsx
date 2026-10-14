// Reusable histogram drawn with plain SVG (no chart library to install).
// Props:
//   edges   - bin edges, length = counts.length + 1
//   counts  - height of each bin
//   flagged - optional counts per bin for flagged events (drawn in red on top)
//   logX    - true when the edges are log-spaced (the mass spectrum)
//   xLabel  - axis label text
import { useMemo } from "react";

const W = 560, H = 260, M = { l: 44, r: 10, t: 10, b: 32 };

export default function Histogram({ edges = [], counts = [], flagged = [], logX = false, xLabel = "" }) {
  const geo = useMemo(() => {
    if (!counts.length) return null;
    const f = logX ? Math.log10 : (v) => v;
    const x0 = f(edges[0]), x1 = f(edges[edges.length - 1]);
    const yMax = Math.max(...counts, 1);
    const sx = (x) => M.l + ((f(x) - x0) / (x1 - x0 || 1)) * (W - M.l - M.r);
    const sy = (y) => H - M.b - (y / yMax) * (H - M.t - M.b);
    return { yMax, sx, sy };
  }, [edges, counts, logX]);

  if (!geo) return <div className="loading">No data</div>;
  const { yMax, sx, sy } = geo;
  const lo = edges[0], hi = edges[edges.length - 1];

  const bars = (arr, cls) =>
    arr.map((c, i) =>
      c > 0 ? (
        <rect key={cls + i} className={cls} x={sx(edges[i])} y={sy(c)}
          width={Math.max(sx(edges[i + 1]) - sx(edges[i]) - 0.5, 0.5)}
          height={H - M.b - sy(c)} />
      ) : null
    );

  // Log axis: ticks at round masses. Linear axis: three even ticks.
  const xTicks = logX
    ? [1, 3, 10, 30, 100, 300].filter((v) => v >= lo && v <= hi)
    : [0, 0.5, 1].map((t) => lo + t * (hi - lo));
  const yTicks = [0, 0.5, 1].map((t) => t * yMax);

  return (
    <svg className="chart" viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label="histogram">
      <line className="axis" x1={M.l} y1={H - M.b} x2={W - M.r} y2={H - M.b} />
      <line className="axis" x1={M.l} y1={M.t} x2={M.l} y2={H - M.b} />
      {bars(counts, "bar")}
      {bars(flagged, "flag")}
      {xTicks.map((v) => (
        <text key={"x" + v} x={sx(v)} y={H - M.b + 14} textAnchor="middle">{+v.toFixed(2)}</text>
      ))}
      {yTicks.map((v) => (
        <text key={"y" + v} x={M.l - 6} y={sy(v) + 3} textAnchor="end">{Math.round(v)}</text>
      ))}
      <text x={(W + M.l) / 2} y={H - 4} textAnchor="middle">{xLabel}</text>
    </svg>
  );
}
