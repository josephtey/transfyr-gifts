import { notFound, redirect } from "next/navigation";
import { cookies } from "next/headers";
import { customers } from "../../../lib/customers";
import { verifySession, cookieName } from "../../../lib/auth";
import { loadArchivedSession } from "../../../lib/session";
import LegacyReview from "../../../components/LegacyReview";
export const dynamic = "force-dynamic";
export default async function ArchivedReview({
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
    redirect(
      `/${customer}/access?next=${encodeURIComponent(`/${customer}/archive`)}`,
    );
  return (
    <LegacyReview
      session={await loadArchivedSession(customer)}
      slug={customer}
    />
  );
}
