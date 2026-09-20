import type { CSSProperties } from "react";
import { metricPercentileContext, type MetricComparison } from "../lib/results";

/** Metric ranks are independent; an overall score rank cannot stand in for them. */
export default function PercentileScale({
  label,
  value,
  comparison,
}: {
  label: string;
  value: string;
  comparison: MetricComparison;
}) {
  const context = metricPercentileContext(comparison);
  if (!context) return null;
  return (
    <div
      className="percentile-scale"
      role="img"
      aria-label={`${label}: ${value}; approximately ${context.ordinal} percentile, ${context.detail} Higher percentiles are better.`}
      title={`${label}: ${context.detail} Higher percentiles are better.`}
    >
      <div className="percentile-scale-label">
        <b>≈{context.ordinal} percentile</b>
        <span>Higher is better</span>
      </div>
      <div
        className="percentile-track"
        aria-hidden="true"
        style={
          { "--marker-position": `${context.percentile}%` } as CSSProperties
        }
      >
        <strong className="percentile-value">{value}</strong>
        <i className="percentile-value-pointer" />
        <i className="percentile-midpoint" />
        <i
          className="percentile-position"
          style={{ left: `${context.percentile}%` }}
        />
      </div>
      <div className="percentile-axis" aria-hidden="true">
        <span>0</span>
        <span>50</span>
        <span>100</span>
      </div>
    </div>
  );
}
