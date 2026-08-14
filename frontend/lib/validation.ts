/**
 * Client-side field checks that mirror the server's rules in `backend/src/schemas.py`.
 *
 * These exist purely so the user gets immediate feedback. The backend performs the same
 * validation independently and is the only place where it counts.
 */

export const PASSWORD_MIN_LENGTH = 8;
export const CODE_LENGTH = 6;

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_PATTERN = /^\+?[0-9\s\-().]{7,25}$/;

export function validateEmail(value: string): string | null {
  if (!value.trim()) return "Enter your email address.";
  if (!EMAIL_PATTERN.test(value.trim())) return "Enter a valid email address.";
  return null;
}

export function validatePhone(value: string): string | null {
  const candidate = value.trim();
  if (!candidate) return "Enter your phone number.";
  if (!PHONE_PATTERN.test(candidate)) return "Enter a valid phone number.";

  const digits = candidate.replace(/\D/g, "").length;
  if (digits < 7 || digits > 15) {
    return "Phone number must contain between 7 and 15 digits.";
  }
  return null;
}

export function validatePassword(value: string): string | null {
  if (!value) return "Choose a password.";
  if (value.length < PASSWORD_MIN_LENGTH) {
    return `Password must be at least ${PASSWORD_MIN_LENGTH} characters.`;
  }
  if (value.length > 128) return "Password must be at most 128 characters.";
  return null;
}

export function validateCode(value: string): string | null {
  if (!value) return "Enter the code from your email.";
  if (!new RegExp(`^\\d{${CODE_LENGTH}}$`).test(value)) {
    return `Enter the ${CODE_LENGTH}-digit code from your email.`;
  }
  return null;
}
