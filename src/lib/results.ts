export type MetricComparison =
  | { rank: number; totalEntries: number }
  | { estimate: number; totalEntries: number };

function ordinal(value: number) {
  const suffix = { one: "st", two: "nd", few: "rd", other: "th" }[
    new Intl.PluralRules("en", { type: "ordinal" }).select(value) as
      "one" | "two" | "few" | "other"
  ];
  return `${value}${suffix}`;
}

/** Share of leaderboard entries ranked below this entry; rank 1 is best. */
export function leaderboardContext(leaderboard?: {
  rank: number;
  totalEntries: number;
}) {
  if (!leaderboard) return null;
  const { rank, totalEntries } = leaderboard;
  if (
    !Number.isInteger(rank) ||
    !Number.isInteger(totalEntries) ||
    totalEntries < 1 ||
    rank < 1 ||
    rank > totalEntries
  )
    return null;
  const below = totalEntries - rank;
  const percentile = Math.round((below / totalEntries) * 100);
  return {
    rank,
    totalEntries,
    percentile,
    ordinal: ordinal(percentile),
    explanation: `Overall performance: ahead of ${below} of ${totalEntries} leaderboard entries (approximately ${percentile}%). Higher percentiles are better. This is the overall rank, not a separate percentile for either measurement.`,
  };
}

/** Keep a visual estimate distinct from an independently calculated metric rank. */
export function metricPercentileContext(comparison: MetricComparison) {
  if ("estimate" in comparison) {
    if (
      !Number.isFinite(comparison.estimate) ||
      comparison.estimate < 0 ||
      comparison.estimate > 100 ||
      !Number.isInteger(comparison.totalEntries) ||
      comparison.totalEntries < 1
    )
      return null;
    const percentile = Math.round(comparison.estimate);
    return {
      percentile,
      ordinal: ordinal(percentile),
      estimated: true,
      detail: `Estimated from the supplied leaderboard image (${comparison.totalEntries} entries).`,
    };
  }
  const context = leaderboardContext(comparison);
  return context
    ? {
        percentile: context.percentile,
        ordinal: context.ordinal,
        estimated: false,
        detail: `Rank ${context.rank} of ${context.totalEntries}.`,
      }
    : null;
}
