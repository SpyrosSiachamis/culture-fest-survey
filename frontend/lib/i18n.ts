/**
 * Locale loading and message formatting.
 *
 * Copy lives in `locales/*.json`, not in this module, so translators can work on plain JSON
 * without touching TypeScript. Survey text is keyed by question id and option value, which keeps
 * `lib/survey.ts` to pure structure — order, kinds and branching.
 *
 * `en.json` is the reference shape: `Dictionary` is derived from it and the `DICTIONARIES` map is
 * typed against that, so a key missing from another locale is a build error rather than an
 * "undefined" rendered at runtime.
 *
 * JSON cannot hold functions, so parameterised strings are `{placeholder}` templates resolved by
 * `format()`.
 *
 * Both locales are bundled. At two small files that costs less than the round trip a dynamic
 * import would add on first paint; worth revisiting if more languages are added.
 */

import el from "@/locales/el.json";
import en from "@/locales/en.json";

export type Lang = "en" | "el";

export const LANGUAGES: { code: Lang; label: string }[] = [
  { code: "en", label: "EN" },
  { code: "el", label: "ΕΛ" },
];

export type Dictionary = typeof en;

/** Copy for one survey question, as stored under `survey.<question id>`. */
export type QuestionCopy = {
  eyebrow: string;
  title: string;
  description?: string;
  note?: string;
  warning?: string;
  lowLabel?: string;
  highLabel?: string;
  options?: Record<string, { label: string; description?: string }>;
};

export const DICTIONARIES: Record<Lang, Dictionary> = { en, el };

/**
 * Substitute `{name}` placeholders in a message.
 *
 * An unknown placeholder is left in place rather than replaced with "undefined", so a mistake
 * shows up legibly in the UI instead of silently reading as real copy.
 */
export function format(
  template: string,
  values: Record<string, string | number>
): string {
  return template.replace(/\{(\w+)\}/g, (whole, key: string) =>
    key in values ? String(values[key]) : whole
  );
}

/** Look up a question's copy with the shape the wizard expects. */
export function questionCopy(dictionary: Dictionary, id: string): QuestionCopy {
  return (dictionary.survey as Record<string, QuestionCopy>)[id];
}
