import { notFound, redirect } from "next/navigation";
import { cookies } from "next/headers";
import { customers } from "../../lib/customers";
import { readSession, cookieName } from "../../lib/auth";
import { loadSession } from "../../lib/session";
import ReviewExperience from "../../components/ReviewExperience";
export const dynamic = "force-dynamic";
export default async function CustomerPage({
  params,
}: {
  params: Promise<{ customer: string }>;
}) {
  const { customer } = await params;
  if (!customers[customer]) notFound();
  const access = await readSession(
    (await cookies()).get(cookieName(customer))?.value,
    customer,
  );
  if (!access) redirect(`/${customer}/access`);
  return (
    <ReviewExperience
      session={await loadSession(customer)}
      slug={customer}
      leaderboardImage={customers[customer].leaderboardImage}
      showIntro={!access.introComplete}
    />
  );
}
