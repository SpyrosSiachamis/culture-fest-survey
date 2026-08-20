/**
 * Survey structure.
 *
 * Structure only — order, answer kinds, branching and the exact option values the backend
 * validates. Every user-visible string lives in `lib/i18n.ts`, keyed by question id and option
 * value, so a new language needs no change here.
 */

export type AudienceType = "student" | "tourist" | "local";

export type QuestionId =
  | "audience_type"
  | "age_range"
  | "gender"
  | "interest_level"
  | "ticket_price_range"
  | "date_preference"
  | "group_size"
  | "recommend_likelihood"
  | "food_stall_interest"
  | "transport_interest"
  | "accommodation_area"
  | "has_student_pass"
  | "open_feedback";

type Base = {
  id: QuestionId;
  optional?: boolean;
  /** Omit to ask everyone; otherwise only these audiences see the question. */
  appliesTo?: AudienceType[];
};

export type Question =
  | (Base & { kind: "single"; values: string[] })
  | (Base & { kind: "bool" })
  | (Base & { kind: "scale" })
  | (Base & { kind: "multi"; values: string[] })
  | (Base & { kind: "text"; maxLength: number; placeholderKey: "area" | "feedback" });

export const QUESTIONS: Question[] = [
  { id: "audience_type", kind: "single", values: ["student", "tourist", "local"] },
  { id: "age_range", kind: "single", optional: true, values: ["18-20", "21-24", "25-29", "30_plus"] },
  { id: "gender", kind: "single", values: ["male", "female", "other"] },
  { id: "interest_level", kind: "scale" },
  { id: "ticket_price_range", kind: "single", values: ["10-20", "20-30", "30-40", "40-50"] },
  // "any" is a selectable answer meaning "all three windows suit me", not a skip — which is why
  // this question is not marked optional.
  {
    id: "date_preference",
    kind: "single",
    values: ["sep-24-27", "sep-28-oct-1", "oct-2-7", "any"],
  },
  { id: "group_size", kind: "single", values: ["alone", "2-3", "4-5", "6_plus"] },
  { id: "recommend_likelihood", kind: "scale" },
  { id: "food_stall_interest", kind: "bool" },
  { id: "transport_interest", kind: "single", appliesTo: ["tourist"], values: ["yes", "maybe", "no"] },
  {
    id: "accommodation_area",
    kind: "text",
    optional: true,
    appliesTo: ["tourist"],
    maxLength: 100,
    placeholderKey: "area",
  },
  { id: "has_student_pass", kind: "bool", appliesTo: ["student"] },
  {
    id: "open_feedback",
    kind: "text",
    optional: true,
    maxLength: 1000,
    placeholderKey: "feedback",
  },
];

/** Total question count used for the step counter, before an audience narrows it. */
export const TOTAL_QUESTIONS = QUESTIONS.length;

/** Only the questions this audience should see. Before they pick, that's just the first one. */
export function questionsFor(audience: AudienceType | null): Question[] {
  if (!audience) return [QUESTIONS[0]];
  return QUESTIONS.filter(
    (question) => !question.appliesTo || question.appliesTo.includes(audience)
  );
}

export type Answers = Partial<Record<QuestionId, string | number | boolean | string[]>>;

/**
 * Build the request body.
 *
 * Conditional fields are omitted entirely rather than sent as null when they do not apply, and
 * blank optional text is dropped so the backend stores NULL instead of an empty string. Filtering
 * to the questions actually asked also stops an answer given before switching audience from
 * leaking into the payload.
 *
 * Nothing identifying is ever included — no account id, no email, no phone. The bearer token is
 * the only thing tying the request to an account, and the backend uses it solely to flip
 * `has_voted`; the stored response carries no reference back to the account.
 */
export function buildPayload(answers: Answers): Record<string, unknown> {
  const audience = answers.audience_type as AudienceType | undefined;
  const allowed = new Set(questionsFor(audience ?? null).map((question) => question.id));

  const payload: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(answers)) {
    if (!allowed.has(key as QuestionId)) continue;
    if (value === undefined || value === null) continue;
    if (typeof value === "string" && value.trim() === "") continue;
    if (Array.isArray(value) && value.length === 0) continue;
    payload[key] = typeof value === "string" ? value.trim() : value;
  }

  return payload;
}
