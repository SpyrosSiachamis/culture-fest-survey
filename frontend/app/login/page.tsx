import { redirect } from "next/navigation";

/**
 * Sign-in lives at `/`. This route stays so existing links and bookmarks keep working, and so
 * there is a single canonical URL for the form.
 */
export default function LoginPage() {
  redirect("/");
}
