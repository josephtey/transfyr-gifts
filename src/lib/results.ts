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
  const suffix = { one: "st", two: "nd", few: "rd", other: "th" }[
    new Intl.PluralRules("en", { type: "ordinal" }).select(percentile) as
      "one" | "two" | "few" | "other"
  ];
  return {
    rank,
    totalEntries,
    percentile,
    ordinal: `${percentile}${suffix}`,
    explanation: `Overall performance: ahead of ${below} of ${totalEntries} leaderboard entries (approximately ${percentile}%). Higher percentiles are better. This is the overall rank, not a separate percentile for either measurement.`,
  };
}
