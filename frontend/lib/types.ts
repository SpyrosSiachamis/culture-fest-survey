/**
 * Wire values mirror backend/src/enums.py and backend/src/schemas.py exactly.
 * These strings are sent verbatim — do not prettify them.
 */

export type AudienceType = "student" | "tourist" | "local";
export type Gender = "male" | "female" | "other";
export type TransportInterest = "yes" | "no" | "maybe";

export type SurveyAnswers = {
  audience_type: AudienceType | null;
  gender: Gender | null;
  age_range: string | null;
  interest_level: number | null;
  recommend_likelihood: number | null;
  ticket_price_range: string | null;
  genre_preferences: string[];
  date_preference: string | null;
  start_time_preference: string | null;
  group_size: string | null;
  food_stall_interest: boolean | null;
  alcohol_preference: string | null;
  open_feedback: string | null;
  // Tourist branch only
  transport_interest: TransportInterest | null;
  accommodation_area: string | null;
  // Student branch only
  has_student_pass: boolean | null;
};

export const emptyAnswers: SurveyAnswers = {
  audience_type: null,
  gender: null,
  age_range: null,
  interest_level: null,
  recommend_likelihood: null,
  ticket_price_range: null,
  genre_preferences: [],
  date_preference: null,
  start_time_preference: null,
  group_size: null,
  food_stall_interest: null,
  alcohol_preference: null,
  open_feedback: null,
  transport_interest: null,
  accommodation_area: null,
  has_student_pass: null,
};

/** Total question count in the finished wizard — drives the "01 / 16" stamp. */
export const TOTAL_STEPS = 16;

/**
 * Builds the /surveys/submit payload.
 *
 * Two rules enforced here:
 *  1. Anonymity — no account id, email or phone is ever attached to a response.
 *  2. Conditional fields — a non-tourist must not send transport_interest /
 *     accommodation_area, and a non-student must not send has_student_pass,
 *     or the backend model_validator rejects the submission with a 422.
 */
export function buildSubmission(a: SurveyAnswers): Record<string, unknown> {
  const payload: Record<string, unknown> = {
    audience_type: a.audience_type,
    gender: a.gender,
    interest_level: a.interest_level,
    recommend_likelihood: a.recommend_likelihood,
    ticket_price_range: a.ticket_price_range,
    genre_preferences: a.genre_preferences,
    date_preference: a.date_preference,
    start_time_preference: a.start_time_preference,
    group_size: a.group_size,
    food_stall_interest: a.food_stall_interest,
  };

  if (a.age_range) payload.age_range = a.age_range;
  if (a.alcohol_preference) payload.alcohol_preference = a.alcohol_preference;
  if (a.open_feedback) payload.open_feedback = a.open_feedback;

  if (a.audience_type === "tourist") {
    payload.transport_interest = a.transport_interest;
    if (a.accommodation_area) payload.accommodation_area = a.accommodation_area;
  }

  if (a.audience_type === "student") {
    payload.has_student_pass = a.has_student_pass;
  }

  return payload;
}
