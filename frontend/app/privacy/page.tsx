import type { Metadata } from "next";

import { PrivacyScreen } from "../components/PrivacyScreen";

/**
 * Static metadata can only carry one language, so it uses the same default the server renders with
 * (see LanguageProvider.getServerSnapshot). The screen itself corrects the title once the visitor's
 * stored locale is known.
 */
export const metadata: Metadata = {
  title: "Privacy Policy · Culture Fest 2026",
  description:
    "How the Culture Fest Project Team handles information collected through the Culture Fest website, account system, and survey.",
};

export default function PrivacyPage() {
  return <PrivacyScreen />;
}
