import { notFound } from "next/navigation";
import { customers } from "../../../lib/customers";
export default async function Access({
  params,
  searchParams,
}: {
  params: Promise<{ customer: string }>;
  searchParams: Promise<{ error?: string; next?: string }>;
}) {
  const { customer } = await params;
  const query = await searchParams;
  if (!customers[customer]) notFound();
  const error =
    query.error === "rate"
      ? "Try again in 15 minutes"
      : query.error
        ? "Incorrect password"
        : undefined;
  return (
    <main className="access-page">
      <form className="access-form" action="/api/access" method="post">
        <input type="hidden" name="customer" value={customer} />
        <input type="hidden" name="next" value={query.next || `/${customer}`} />
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          aria-label="Access password"
          aria-invalid={error ? true : undefined}
          placeholder={error || "Access password"}
          title={error}
          required
          autoFocus
        />
      </form>
    </main>
  );
}
