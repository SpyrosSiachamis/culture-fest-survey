/**
 * Human-readable names for the categories the analytics API reports.
 *
 * The API sends values, never labels — `"30_plus"`, not `"30 or over"`. Those values are the same
 * ones the survey uses, and the survey's copy is already translated in `locales/*.json` under
 * `survey.<field>.options.<value>.label`, so the dashboard reads its labels from there rather than
 * keeping a second list. One consequence worth the trade: adding an option to the backend enum
 * makes it appear on the dashboard immediately, labelled once its locale entry is written and
 * showing its raw value until then.
 *
 * The raw-value fallback is not just for that case. A response stored before an option was renamed
 * still counts, and the backend passes it through instead of dropping it, so something has to be
 * able to render a value the locale files have never heard of.
 */

import type { Dictionary } from "@/lib/i18n";

type OptionCopy = { label: string; description?: string };
type QuestionCopy = { title?: string; options?: Record<string, OptionCopy> };

function question(t: Dictionary, field: string): QuestionCopy | undefined {
  return (t.survey as Record<string, QuestionCopy>)[field];
}

/** The question's own title, e.g. "What would you pay?". Falls back to the field name. */
export function fieldLabel(t: Dictionary, field: string): string {
  return question(t, field)?.title ?? field;
}

/** One answer's label. Falls back to the raw value, which is always readable if not pretty. */
export function valueLabel(t: Dictionary, field: string, value: string): string {
  return question(t, field)?.options?.[value]?.label ?? value;
}
