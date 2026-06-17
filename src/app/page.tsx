import { LandingPage } from "@src/features/explanation";
import { getAuthenticatedUser } from "@src/lib/auth";

export default async function Page() {
  const user = await getAuthenticatedUser();

  return <LandingPage isAuthenticated={!!user} />;
}
