import { LogOut } from "lucide-react";

export default function ExitButton({ slug }: { slug: string }) {
  return (
    <form className="exit-form" action="/api/access" method="post">
      <input type="hidden" name="customer" value={slug} />
      <input type="hidden" name="logout" value="1" />
      <input type="hidden" name="next" value={`/${slug}`} />
      <button type="submit" className="exit-button" aria-label="Exit">
        <LogOut size={14} aria-hidden="true" />
        <span>Exit</span>
      </button>
    </form>
  );
}
