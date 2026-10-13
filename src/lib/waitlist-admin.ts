import "server-only";

export function isWaitlistAdminEmail(email: string | null | undefined) {
  const normalizedEmail = email?.trim().toLowerCase();

  if (!normalizedEmail) return false;

  return (process.env.WAITLIST_ADMIN_EMAILS || "")
    .split(",")
    .map((allowedEmail) => allowedEmail.trim().toLowerCase())
    .filter(Boolean)
    .includes(normalizedEmail);
}
