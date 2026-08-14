/**
 * Client-side field checks that mirror the server's rules in `backend/src/schemas.py`.
 *
 * These exist purely so the user gets immediate feedback in their own language. The backend
 * performs the same validation independently and is the only place where it counts.
 */

import type { Dictionary } from "@/lib/i18n";

export const PASSWORD_MIN_LENGTH = 8;
export const CODE_LENGTH = 6;

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_PATTERN = /^\+?[0-9\s\-().]{7,25}$/;

/** Validators bound to a language, so messages match the rest of the screen. */
export function makeValidators(t: Dictionary) {
  return {
    email(value: string): string | null {
      if (!value.trim()) return t.errors.emailRequired;
      if (!EMAIL_PATTERN.test(value.trim())) return t.errors.emailInvalid;
      return null;
    },

    phone(value: string): string | null {
      const candidate = value.trim();
      if (!candidate) return t.errors.phoneRequired;
      if (!PHONE_PATTERN.test(candidate)) return t.errors.phoneInvalid;

      const digits = candidate.replace(/\D/g, "").length;
      if (digits < 7 || digits > 15) return t.errors.phoneDigits;
      return null;
    },

    password(value: string): string | null {
      if (!value) return t.errors.passwordRequired;
      if (value.length < PASSWORD_MIN_LENGTH) {
        return t.errors.passwordShort(PASSWORD_MIN_LENGTH);
      }
      if (value.length > 128) return t.errors.passwordLong;
      return null;
    },

    /** Sign-in only checks presence — never hint at the password rules on a login form. */
    passwordPresent(value: string): string | null {
      return value ? null : t.errors.passwordRequired;
    },

    code(value: string): string | null {
      if (!value) return t.errors.codeRequired;
      if (!new RegExp(`^\\d{${CODE_LENGTH}}$`).test(value)) return t.errors.codeFormat;
      return null;
    },
  };
}
