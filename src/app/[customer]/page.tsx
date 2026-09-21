import { notFound, redirect } from "next/navigation";
import { cookies } from "next/headers";
import { customers } from "../../lib/customers";
import { verifySession, cookieName } from "../../lib/auth";
import { loadSession } from "../../lib/session";
import Review from "../../components/Review";
export const dynamic = "force-dynamic";
export default async function CustomerPage({
  params,
}: {
  params: Promise<{ customer: string }>;
}) {
  const { customer } = await params;
  if (!customers[customer]) notFound();
  if (
    !(await verifySession(
      (await cookies()).get(cookieName(customer))?.value,
      customer,
    ))
  )
    redirect(`/${customer}/access`);
  return (
    <Review
      session={await loadSession(customer)}
      slug={customer}
      leaderboardImage={customers[customer].leaderboardImage}
    />
  );
}
