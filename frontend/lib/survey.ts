/**
 * Survey definition.
 *
 * The wizard is data-driven: this file is the single place questions are declared, ordered and
 * branched. Option `value`s are the exact strings `POST /surveys/submit` expects — the backend
 * validates them, so they must not be prettified here (labels carry the display text instead).
 */

export type AudienceType = "student" | "tourist" | "local";

export type QuestionId =
  | "audience_type"
  | "age_range"
  | "gender"
  | "interest_level"
  | "ticket_price_range"
  | "genre_preferences"
  | "date_preference"
  | "start_time_preference"
  | "group_size"
  | "recommend_likelihood"
  | "food_stall_interest"
  | "alcohol_preference"
  | "transport_interest"
  | "accommodation_area"
  | "has_student_pass"
  | "open_feedback";

type Choice = { value: string; label: string; description?: string };

type Base = {
  id: QuestionId;
  title: string;
  description?: string;
  optional?: boolean;
  /** Omit to ask everyone; otherwise only these audiences see the question. */
  appliesTo?: AudienceType[];
  /** Extra context shown in an info panel under the question. */
  note?: string;
  /** Shown as a prominent warning. Used for the accommodation-area anonymity disclosure. */
  warning?: string;
};

export type Question =
  | (Base & { kind: "single"; options: Choice[] })
  | (Base & { kind: "bool"; trueLabel: string; falseLabel: string })
  | (Base & { kind: "scale"; lowLabel: string; highLabel: string })
  | (Base & { kind: "multi"; options: Choice[] })
  | (Base & { kind: "text"; placeholder: string; maxLength: number });

export const QUESTIONS: Question[] = [
  {
    id: "audience_type",
    kind: "single",
    title: "Which one are you?",
    description: "This shapes the rest of the questions, so start here.",
    options: [
      { value: "student", label: "Student", description: "Studying in or around Hersonissos" },
      { value: "tourist", label: "Tourist", description: "Visiting the area" },
      { value: "local", label: "Local", description: "Living here year-round" },
    ],
  },
  {
    id: "age_range",
    kind: "single",
    title: "How old are you?",
    optional: true,
    options: [
      { value: "18-20", label: "18–20" },
      { value: "21-24", label: "21–24" },
      { value: "25-29", label: "25–29" },
      { value: "30_plus", label: "30 or over" },
    ],
  },
  {
    id: "gender",
    kind: "single",
    title: "How do you identify?",
    options: [
      { value: "male", label: "Male" },
      { value: "female", label: "Female" },
      { value: "other", label: "Other" },
    ],
  },
  {
    id: "interest_level",
    kind: "scale",
    title: "How into this are you?",
    description: "1 means you'd skip it, 10 means you're already telling your friends.",
    lowLabel: "Not for me",
    highLabel: "Take my money",
  },
  {
    id: "ticket_price_range",
    kind: "single",
    title: "What would you pay?",
    description: "For a full night with the lineup announced.",
    options: [
      { value: "10-20", label: "€10–20" },
      { value: "20-30", label: "€20–30" },
      { value: "30-40", label: "€30–40" },
      { value: "over_40", label: "Over €40" },
    ],
  },
  {
    id: "genre_preferences",
    kind: "multi",
    title: "What should we play?",
    description: "Pick as many as you like.",
    options: [
      { value: "greek-pop", label: "Greek pop" },
      { value: "hip-hop", label: "Hip-hop" },
      { value: "trap", label: "Trap" },
      { value: "r&b", label: "R&B" },
      { value: "reggaeton", label: "Reggaeton / Latin" },
      { value: "house", label: "House" },
      { value: "techno", label: "Techno" },
      { value: "laiko", label: "Laïkó / Éntehno" },
      { value: "rock", label: "Rock" },
    ],
  },
  {
    id: "date_preference",
    kind: "single",
    title: "When works best?",
    description: "The festival is planned for September.",
    // Intentionally not specific calendar dates — see the note in the README / handover.
    options: [
      { value: "early-september", label: "Early September", description: "First two weeks" },
      { value: "late-september", label: "Late September", description: "Last two weeks" },
      { value: "weekend-only", label: "Any weekend", description: "As long as it's Fri–Sun" },
      { value: "any", label: "Any date works" },
    ],
  },
  {
    id: "start_time_preference",
    kind: "single",
    title: "What time should it kick off?",
    options: [
      { value: "20:00", label: "Around 20:00" },
      { value: "21:00", label: "Around 21:00" },
      { value: "22:00", label: "Around 22:00" },
      { value: "23:00_later", label: "23:00 or later" },
    ],
  },
  {
    id: "group_size",
    kind: "single",
    title: "Who are you coming with?",
    options: [
      { value: "alone", label: "On my own" },
      { value: "2-3", label: "2–3 of us" },
      { value: "4-5", label: "4–5 of us" },
      { value: "6_plus", label: "6 or more" },
    ],
  },
  {
    id: "recommend_likelihood",
    kind: "scale",
    title: "Would you tell a friend?",
    description: "How likely are you to recommend this to someone you know?",
    lowLabel: "Not likely",
    highLabel: "Definitely",
  },
  {
    id: "food_stall_interest",
    kind: "bool",
    title: "Want food stalls?",
    trueLabel: "Yes, feed me",
    falseLabel: "Not fussed",
  },
  {
    id: "alcohol_preference",
    kind: "single",
    title: "What are you drinking?",
    optional: true,
    options: [
      { value: "beer", label: "Beer" },
      { value: "wine", label: "Wine" },
      { value: "spirits", label: "Spirits / cocktails" },
      { value: "none", label: "Nothing alcoholic" },
      { value: "no-preference", label: "No preference" },
    ],
  },
  {
    id: "transport_interest",
    kind: "single",
    title: "Would you use shuttle transport?",
    appliesTo: ["tourist"],
    note: "Transport is €2 flat for visitors. Students with a valid pass travel free.",
    options: [
      { value: "yes", label: "Yes" },
      { value: "maybe", label: "Maybe" },
      { value: "no", label: "No" },
    ],
  },
  {
    id: "accommodation_area",
    kind: "text",
    title: "Where are you staying?",
    optional: true,
    placeholder: "e.g. Stalis",
    maxLength: 100,
    warning:
      "Optional, and worth thinking about: few people answer from any one area, so filling this in could make your response identifiable. Leave it blank and your answers stay anonymous.",
  },
  {
    id: "has_student_pass",
    kind: "bool",
    title: "Do you have a student transport pass?",
    appliesTo: ["student"],
    note: "Students with a valid pass travel free. Everyone else pays €2 flat.",
    trueLabel: "Yes, I have one",
    falseLabel: "No, I don't",
  },
  {
    id: "open_feedback",
    kind: "text",
    title: "Anything else?",
    description: "Artists you want, things we should avoid — all of it helps.",
    optional: true,
    placeholder: "Tell us what would make this worth your night out.",
    maxLength: 1000,
  },
];

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
 * blank optional text is dropped so the backend stores NULL instead of an empty string.
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
