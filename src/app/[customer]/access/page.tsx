import { notFound } from "next/navigation";
import { ArrowRight, LockKeyhole } from "lucide-react";
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
  return (
    <main className="access-page">
      <a className="wordmark" href="/">
        transfyr
        <span className="brand-dot" />
      </a>
      <section className="access-card">
        <div className="lock-icon">
          <LockKeyhole size={22} />
        </div>
        <p className="access-recipient">
          Prepared for {customers[customer].name}
        </p>
        <h1>Calibration review</h1>
        <form action="/api/access" method="post">
          <input type="hidden" name="customer" value={customer} />
          <input
            type="hidden"
            name="next"
            value={query.next || `/${customer}`}
          />
          <label htmlFor="password">Access password</label>
          <input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            placeholder="Enter your password"
            required
            autoFocus
          />
          {query.error && (
            <p className="form-error" role="alert">
              {query.error === "rate"
                ? "Too many attempts. Please try again in 15 minutes."
                : "That password doesn’t match. Please try again."}
            </p>
          )}
          <button type="submit" className="primary">
            Open your review <ArrowRight size={17} />
          </button>
        </form>
        <small>Private review. Enter the password from your invitation.</small>
      </section>
      <footer>Observation is the beginning of understanding.</footer>
    </main>
  );
}
