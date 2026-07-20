import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";

// Root is a pure redirect target — but must not blindly assume /dashboard is
// reachable. getCurrentUser() redirects to /login itself when there's no
// session (mirrors (app)/layout.tsx), so this is real defense-in-depth rather
// than relying solely on proxy.ts having already caught the request.
export default async function Home() {
  await getCurrentUser();
  redirect("/dashboard");
}
