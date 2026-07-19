/* Chart marks (SVG, no deps): lines, stacked areas, and bars. 2px lines,
   recessive grid, crosshair + shared tooltip, direct end-labels, 1.5px
   surface gaps between stacked fills. One axis, always. */

import { useMemo, useRef, useState } from "react";
import { fmtMoney } from "../state/store";

export interface Series {
  id: string;
  name: string;
  color: string;
  points: { x: number; y: number }[];
}

export function LineChart({
  series,
  height = 300,
  yLabel,
}: {
  series: Series[];
  height?: number;
  yLabel: string;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [hover, setHover] = useState<{ xIndex: number; px: number; py: number } | null>(null);
  const width = 900; // viewBox width; scales responsively
  const pad = { left: 62, right: 84, top: 14, bottom: 26 };

  const { xs, scaleX, scaleY, ticks } = useMemo(() => {
    const xs = series[0]?.points.map((p) => p.x) ?? [];
    const allY = series.flatMap((s) => s.points.map((p) => p.y));
    const rawMax = Math.max(...allY, 1);
    const magnitude = 10 ** Math.floor(Math.log10(rawMax));
    const yMax = Math.ceil(rawMax / magnitude) * magnitude;
    const xMin = xs[0] ?? 0;
    const xMax = xs[xs.length - 1] ?? 1;
    const scaleX = (x: number) =>
      pad.left + ((x - xMin) / Math.max(xMax - xMin, 1)) * (width - pad.left - pad.right);
    const scaleY = (y: number) =>
      height - pad.bottom - (y / yMax) * (height - pad.top - pad.bottom);
    const ticks = [0, 0.25, 0.5, 0.75, 1].map((t) => t * yMax);
    return { xs, yMax, scaleX, scaleY, ticks };
  }, [series, height]);

  if (!series.length || !xs.length) return <p className="notice">No data yet.</p>;

  function handleMove(event: React.MouseEvent<SVGSVGElement>) {
    const svg = event.currentTarget;
    const rect = svg.getBoundingClientRect();
    const px = ((event.clientX - rect.left) / rect.width) * width;
    let best = 0;
    let bestDist = Infinity;
    xs.forEach((x, i) => {
      const dist = Math.abs(scaleX(x) - px);
      if (dist < bestDist) {
        bestDist = dist;
        best = i;
      }
    });
    setHover({
      xIndex: best,
      px: (scaleX(xs[best]) / width) * rect.width,
      py: event.clientY - rect.top,
    });
  }

  const hoverX = hover ? xs[hover.xIndex] : null;

  return (
    <div className="chart-wrap" ref={wrapRef}>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        style={{ width: "100%", height: "auto", display: "block" }}
        onMouseMove={handleMove}
        onMouseLeave={() => setHover(null)}
        role="img"
        aria-label={`${yLabel} by year for ${series.map((s) => s.name).join(", ")}`}
      >
        {ticks.map((t) => (
          <g key={t}>
            <line
              x1={pad.left}
              x2={width - pad.right}
              y1={scaleY(t)}
              y2={scaleY(t)}
              stroke="var(--line-2)"
              strokeWidth={1}
            />
            <text
              x={pad.left - 8}
              y={scaleY(t) + 3.5}
              textAnchor="end"
              fontSize={10.5}
              fontFamily="var(--font-mono)"
              fill="var(--ink-3)"
            >
              {fmtMoney(t, true)}
            </text>
          </g>
        ))}
        {[xs[0], xs[Math.floor(xs.length / 2)], xs[xs.length - 1]].map((x) => (
          <text
            key={x}
            x={scaleX(x)}
            y={height - 8}
            textAnchor="middle"
            fontSize={10.5}
            fontFamily="var(--font-mono)"
            fill="var(--ink-3)"
          >
            {x}
          </text>
        ))}
        {hoverX !== null && (
          <line
            x1={scaleX(hoverX)}
            x2={scaleX(hoverX)}
            y1={pad.top}
            y2={height - pad.bottom}
            stroke="var(--ink-3)"
            strokeWidth={1}
            strokeDasharray="3 3"
          />
        )}
        {series.map((s) => {
          const d = s.points
            .map((p, i) => `${i === 0 ? "M" : "L"}${scaleX(p.x).toFixed(1)},${scaleY(p.y).toFixed(1)}`)
            .join(" ");
          const end = s.points[s.points.length - 1];
          return (
            <g key={s.id}>
              <path d={d} fill="none" stroke={s.color} strokeWidth={2} strokeLinejoin="round" />
              <text
                x={scaleX(end.x) + 6}
                y={scaleY(end.y) + 3.5}
                fontSize={11}
                fontWeight={600}
                fontFamily="var(--font-ui)"
                fill="var(--ink)"
              >
                {s.name}
              </text>
              {hover && (
                <circle
                  cx={scaleX(s.points[hover.xIndex].x)}
                  cy={scaleY(s.points[hover.xIndex].y)}
                  r={4}
                  fill={s.color}
                  stroke="var(--card)"
                  strokeWidth={2}
                />
              )}
            </g>
          );
        })}
      </svg>
      {hover && hoverX !== null && (
        <div className="chart-tip" style={{ left: hover.px, top: Math.max(hover.py - 8, 40) }}>
          <div style={{ fontWeight: 600, marginBottom: 2 }}>{hoverX}</div>
          {series.map((s) => (
            <div key={s.id}>
              <span style={{ color: s.color }}>●</span> {s.name}:{" "}
              {fmtMoney(s.points[hover.xIndex].y, true)}
            </div>
          ))}
        </div>
      )}
      <div className="legend">
        {series.map((s) => (
          <span key={s.id}>
            <span
              style={{
                width: 10,
                height: 10,
                borderRadius: "50%",
                background: s.color,
                display: "inline-block",
              }}
            />
            {s.name}
          </span>
        ))}
        <span style={{ marginLeft: "auto", color: "var(--ink-3)" }}>{yLabel}</span>
      </div>
    </div>
  );
}

/* ---------- stacked area ---------- */

export function StackedArea({
  series,
  height = 280,
  yLabel,
}: {
  series: Series[]; // bottom-first stacking order; identical x arrays
  height?: number;
  yLabel: string;
}) {
  const [hover, setHover] = useState<{ i: number; px: number; py: number } | null>(null);
  const width = 900;
  const pad = { left: 62, right: 20, top: 14, bottom: 26 };

  const model = useMemo(() => {
    const xs = series[0]?.points.map((p) => p.x) ?? [];
    const stacked = series.map(() => [] as number[]);
    const totals = xs.map((_, i) => {
      let cum = 0;
      series.forEach((s, si) => {
        cum += Math.max(s.points[i]?.y ?? 0, 0);
        stacked[si][i] = cum;
      });
      return cum;
    });
    const rawMax = Math.max(...totals, 1);
    const magnitude = 10 ** Math.floor(Math.log10(rawMax));
    const yMax = Math.ceil(rawMax / magnitude) * magnitude;
    const xMin = xs[0] ?? 0;
    const xMax = xs[xs.length - 1] ?? 1;
    const sx = (x: number) => pad.left + ((x - xMin) / Math.max(xMax - xMin, 1)) * (width - pad.left - pad.right);
    const sy = (y: number) => height - pad.bottom - (y / yMax) * (height - pad.top - pad.bottom);
    return { xs, stacked, yMax, sx, sy };
  }, [series, height]);

  if (!series.length || !model.xs.length) return <p className="notice">No data yet.</p>;
  const { xs, stacked, yMax, sx, sy } = model;

  function onMove(e: React.MouseEvent<SVGSVGElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    const px = ((e.clientX - rect.left) / rect.width) * width;
    let best = 0, bd = Infinity;
    xs.forEach((x, i) => { const d = Math.abs(sx(x) - px); if (d < bd) { bd = d; best = i; } });
    setHover({ i: best, px: (sx(xs[best]) / width) * rect.width, py: e.clientY - rect.top });
  }

  return (
    <div className="chart-wrap">
      <svg viewBox={`0 0 ${width} ${height}`} style={{ width: "100%", height: "auto", display: "block" }}
        onMouseMove={onMove} onMouseLeave={() => setHover(null)} role="img" aria-label={yLabel}>
        {[0.25, 0.5, 0.75, 1].map((t) => (
          <g key={t}>
            <line x1={pad.left} x2={width - pad.right} y1={sy(t * yMax)} y2={sy(t * yMax)} stroke="var(--line-2)" strokeWidth={1} />
            <text x={pad.left - 8} y={sy(t * yMax) + 3.5} textAnchor="end" fontSize={10.5} fontFamily="var(--font-mono)" fill="var(--ink-3)">
              {fmtMoney(t * yMax, true)}
            </text>
          </g>
        ))}
        {series.map((s, si) => {
          const top = stacked[si];
          const bottom = si === 0 ? xs.map(() => 0) : stacked[si - 1];
          const d =
            xs.map((x, i) => `${i === 0 ? "M" : "L"}${sx(x).toFixed(1)},${sy(top[i]).toFixed(1)}`).join(" ") +
            [...xs].reverse().map((x, ri) => { const i = xs.length - 1 - ri; return `L${sx(x).toFixed(1)},${sy(bottom[i]).toFixed(1)}`; }).join(" ") + "Z";
          return <path key={s.id} d={d} fill={s.color} stroke="var(--card)" strokeWidth={1.5} />;
        })}
        {[xs[0], xs[Math.floor(xs.length / 2)], xs[xs.length - 1]].map((x) => (
          <text key={x} x={sx(x)} y={height - 8} textAnchor="middle" fontSize={10.5} fontFamily="var(--font-mono)" fill="var(--ink-3)">{x}</text>
        ))}
        {hover && <line x1={sx(xs[hover.i])} x2={sx(xs[hover.i])} y1={pad.top} y2={height - pad.bottom} stroke="var(--ink-3)" strokeWidth={1} strokeDasharray="3 3" />}
      </svg>
      {hover && (
        <div className="chart-tip" style={{ left: hover.px, top: Math.max(hover.py - 8, 40) }}>
          <div style={{ fontWeight: 600, marginBottom: 2 }}>{xs[hover.i]}</div>
          {[...series].reverse().map((s) => {
            const v = s.points[hover.i]?.y ?? 0;
            return Math.abs(v) < 0.5 ? null : (
              <div key={s.id}><span style={{ color: s.color }}>■</span> {s.name}: {fmtMoney(v, true)}</div>
            );
          })}
        </div>
      )}
      <div className="legend">
        {series.map((s) => (
          <span key={s.id}>
            <span style={{ width: 10, height: 10, borderRadius: 2, background: s.color, display: "inline-block" }} />
            {s.name}
          </span>
        ))}
        <span style={{ marginLeft: "auto", color: "var(--ink-3)" }}>{yLabel}</span>
      </div>
    </div>
  );
}

/* ---------- bars (single or stacked; supports negatives for net CF) ---------- */

export function Bars({
  series,
  height = 260,
  yLabel,
  negativeColor,
}: {
  series: Series[]; // stacked if >1 (positives only); single series may go negative
  height?: number;
  yLabel: string;
  negativeColor?: string;
}) {
  const [hover, setHover] = useState<{ i: number; px: number; py: number } | null>(null);
  const width = 900;
  const pad = { left: 62, right: 20, top: 14, bottom: 26 };

  const model = useMemo(() => {
    const xs = series[0]?.points.map((p) => p.x) ?? [];
    const totalsPos = xs.map((_, i) => series.reduce((s, sr) => s + Math.max(sr.points[i]?.y ?? 0, 0), 0));
    const totalsNeg = xs.map((_, i) => series.reduce((s, sr) => s + Math.min(sr.points[i]?.y ?? 0, 0), 0));
    const rawMax = Math.max(...totalsPos, 1);
    const rawMin = Math.min(...totalsNeg, 0);
    const magnitude = 10 ** Math.floor(Math.log10(Math.max(rawMax, -rawMin, 1)));
    const yMax = Math.ceil(rawMax / magnitude) * magnitude;
    const yMin = rawMin < 0 ? -Math.ceil(-rawMin / magnitude) * magnitude : 0;
    const xMin = xs[0] ?? 0;
    const xMax = xs[xs.length - 1] ?? 1;
    const sx = (x: number) => pad.left + ((x - xMin) / Math.max(xMax - xMin, 1)) * (width - pad.left - pad.right);
    const sy = (y: number) => {
      const span = yMax - yMin || 1;
      return height - pad.bottom - ((y - yMin) / span) * (height - pad.top - pad.bottom);
    };
    const bw = Math.max(((width - pad.left - pad.right) / Math.max(xs.length, 1)) - 2, 2);
    return { xs, yMax, yMin, sx, sy, bw };
  }, [series, height]);

  if (!series.length || !model.xs.length) return <p className="notice">No data yet.</p>;
  const { xs, yMax, yMin, sx, sy, bw } = model;

  function onMove(e: React.MouseEvent<SVGSVGElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    const px = ((e.clientX - rect.left) / rect.width) * width;
    let best = 0, bd = Infinity;
    xs.forEach((x, i) => { const d = Math.abs(sx(x) - px); if (d < bd) { bd = d; best = i; } });
    setHover({ i: best, px: (sx(xs[best]) / width) * rect.width, py: e.clientY - rect.top });
  }

  return (
    <div className="chart-wrap">
      <svg viewBox={`0 0 ${width} ${height}`} style={{ width: "100%", height: "auto", display: "block" }}
        onMouseMove={onMove} onMouseLeave={() => setHover(null)} role="img" aria-label={yLabel}>
        {[yMin, 0, yMax * 0.5, yMax].filter((v, i, a) => a.indexOf(v) === i).map((t) => (
          <g key={t}>
            <line x1={pad.left} x2={width - pad.right} y1={sy(t)} y2={sy(t)} stroke={t === 0 ? "var(--ink-3)" : "var(--line-2)"} strokeWidth={1} />
            <text x={pad.left - 8} y={sy(t) + 3.5} textAnchor="end" fontSize={10.5} fontFamily="var(--font-mono)" fill="var(--ink-3)">
              {fmtMoney(t, true)}
            </text>
          </g>
        ))}
        {xs.map((x, i) => {
          let cumPos = 0;
          return (
            <g key={x}>
              {series.map((s) => {
                const v = s.points[i]?.y ?? 0;
                if (v >= 0) {
                  const y0 = cumPos; cumPos += v;
                  return <rect key={s.id} x={sx(x) - bw / 2} y={sy(cumPos)} width={bw} height={Math.max(sy(y0) - sy(cumPos), 0)} fill={s.color} rx={1} />;
                }
                return <rect key={s.id} x={sx(x) - bw / 2} y={sy(0)} width={bw} height={Math.max(sy(v) - sy(0), 0)} fill={negativeColor ?? "#A3382D"} rx={1} />;
              })}
            </g>
          );
        })}
        {[xs[0], xs[Math.floor(xs.length / 2)], xs[xs.length - 1]].map((x) => (
          <text key={x} x={sx(x)} y={height - 8} textAnchor="middle" fontSize={10.5} fontFamily="var(--font-mono)" fill="var(--ink-3)">{x}</text>
        ))}
      </svg>
      {hover && (
        <div className="chart-tip" style={{ left: hover.px, top: Math.max(hover.py - 8, 40) }}>
          <div style={{ fontWeight: 600, marginBottom: 2 }}>{xs[hover.i]}</div>
          {series.map((s) => {
            const v = s.points[hover.i]?.y ?? 0;
            return Math.abs(v) < 0.5 ? null : (
              <div key={s.id}><span style={{ color: v < 0 ? (negativeColor ?? "#A3382D") : s.color }}>■</span> {s.name}: {fmtMoney(v, true)}</div>
            );
          })}
        </div>
      )}
      <div className="legend">
        {series.map((s) => (
          <span key={s.id}>
            <span style={{ width: 10, height: 10, borderRadius: 2, background: s.color, display: "inline-block" }} />
            {s.name}
          </span>
        ))}
        <span style={{ marginLeft: "auto", color: "var(--ink-3)" }}>{yLabel}</span>
      </div>
    </div>
  );
}
