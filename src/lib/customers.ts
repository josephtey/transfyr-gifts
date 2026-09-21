// Public routing metadata only. Never put passwords or evidence in this file.
export const customers: Record<
  string,
  {
    name: string;
    passwordEnv: string;
    leaderboardImage?: string;
    protocolImage?: string;
  }
> = {
  genentech: {
    name: "Genentech",
    passwordEnv: "CUSTOMER_PASSWORD_GENENTECH",
    leaderboardImage: "leaderboard.png",
    protocolImage: "protocol.png",
  },
};
export function customerForHost(host: string): string | undefined {
  // Explicit mapping avoids treating arbitrary/untrusted subdomains as customers.
  const map = JSON.parse(process.env.CUSTOMER_HOSTS || "{}") as Record<
    string,
    string
  >;
  const slug = map[host.split(":")[0].toLowerCase()];
  return slug && customers[slug] ? slug : undefined;
}
