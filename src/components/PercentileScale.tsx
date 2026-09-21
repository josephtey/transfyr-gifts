import { metricPercentileContext, type MetricComparison } from "../lib/results";

/** The dot represents relative performance, never the measured percentage. */
export default function PercentileScale({
  label,
  comparison,
}: {
  label: string;
  comparison: MetricComparison;
}) {
  const context = metricPercentileContext(comparison);
  if (!context) return null;
  const betterPercent = 100 - context.percentile;
  return (
    <div
      className="percentile-scale"
      role="img"
      aria-label={`${label} performance: approximately ${context.ordinal} percentile; about ${betterPercent}% of the cohort performed better. ${context.detail}`}
      title={`${label} performance: ${context.detail}`}
    >
      <span className="performance-label">Performance</span>
      <div className="performance-axis" aria-hidden="true">
        <span>LOW</span>
        <div className="percentile-track">
          <i className="percentile-midpoint" />
          <i
            className="percentile-position"
            style={{ left: `${context.percentile}%` }}
          />
        </div>
        <span>HIGH</span>
      </div>
      <p className="percentile-caption">
        <b>≈{context.ordinal} percentile</b>
        <span> · ~{betterPercent}% performed better</span>
      </p>
    </div>
  );
}
