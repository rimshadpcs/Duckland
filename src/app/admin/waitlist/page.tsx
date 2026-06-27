import { requireAuthenticatedUser } from "@src/lib/auth";
import { createSupabaseAdminClient } from "@src/lib/supabase/admin";
import type { Database } from "@src/types/database";

export const dynamic = "force-dynamic";

type WaitlistEntry = Database["public"]["Tables"]["waitlist_entries"]["Row"];

function getAllowedEmails() {
  return (process.env.WAITLIST_ADMIN_EMAILS || "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function csvHref(entries: WaitlistEntry[]) {
  const headers = ["created_at", "name", "email", "school", "study_area", "source"];
  const rows = entries.map((entry) => [
    entry.created_at,
    entry.name || "",
    entry.email,
    entry.school || "",
    entry.study_focus || "",
    entry.source,
  ]);
  const escape = (value: string) => `"${value.replaceAll('"', '""')}"`;
  const csv = [headers, ...rows].map((row) => row.map(escape).join(",")).join("\n");
  return `data:text/csv;charset=utf-8,${encodeURIComponent(csv)}`;
}

export default async function WaitlistAdminPage() {
  const user = await requireAuthenticatedUser("/admin/waitlist");
  const allowedEmails = getAllowedEmails();
  const userEmail = user.email?.toLowerCase() ?? "";
  const isAllowed = allowedEmails.length > 0 && allowedEmails.includes(userEmail);

  if (!isAllowed) {
    return (
      <main className="admin-page">
        <section className="admin-shell">
          <a className="admin-back-link" href="/">
            Back to Feynduck
          </a>
          <div className="admin-empty">
            <p>Waitlist admin</p>
            <h1>Access is restricted.</h1>
            <span>Add your email to WAITLIST_ADMIN_EMAILS to view waitlist entries.</span>
          </div>
        </section>
      </main>
    );
  }

  let entries: WaitlistEntry[] = [];
  let errorMessage = "";

  try {
    const supabase = createSupabaseAdminClient();
    const { data, error } = await supabase
      .from("waitlist_entries")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(500);

    if (error) {
      errorMessage = error.message;
    } else {
      entries = data ?? [];
    }
  } catch (error) {
    errorMessage = error instanceof Error ? error.message : "Could not load waitlist entries.";
  }

  return (
    <main className="admin-page">
      <section className="admin-shell">
        <div className="admin-header">
          <div>
            <a className="admin-back-link" href="/">
              Back to Feynduck
            </a>
            <p>Waitlist admin</p>
            <h1>Waitlist entries</h1>
          </div>
          <div className="admin-stats">
            <span>Total</span>
            <strong>{entries.length}</strong>
          </div>
        </div>

        {errorMessage ? (
          <div className="admin-empty">
            <p>Could not load waitlist</p>
            <h1>Supabase needs one more setting.</h1>
            <span>{errorMessage}</span>
          </div>
        ) : (
          <>
            <div className="admin-toolbar">
              <p>Showing latest {entries.length} signups.</p>
              <a href={csvHref(entries)} download="feynduck-waitlist.csv">
                Export CSV
              </a>
            </div>

            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Joined</th>
                    <th>Name</th>
                    <th>Email</th>
                    <th>School</th>
                    <th>Study area</th>
                    <th>Source</th>
                  </tr>
                </thead>
                <tbody>
                  {entries.length ? (
                    entries.map((entry) => (
                      <tr key={entry.id}>
                        <td>{formatDate(entry.created_at)}</td>
                        <td>{entry.name || "—"}</td>
                        <td>
                          <a href={`mailto:${entry.email}`}>{entry.email}</a>
                        </td>
                        <td>{entry.school || "—"}</td>
                        <td>{entry.study_focus || "—"}</td>
                        <td>{entry.source}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={6}>No waitlist entries yet.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </>
        )}
      </section>
    </main>
  );
}
