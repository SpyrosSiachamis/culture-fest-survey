"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * A countdown in whole seconds, used for the visible resend cooldown.
 *
 * This is presentation only. The cooldown is enforced server-side regardless of what the browser
 * does, so a user who edits or bypasses this timer simply gets no email.
 */
export function useCooldown() {
  const [secondsLeft, setSecondsLeft] = useState(0);
  const deadlineRef = useRef<number>(0);

  useEffect(() => {
    if (secondsLeft <= 0) return;

    const interval = setInterval(() => {
      const remaining = Math.ceil((deadlineRef.current - Date.now()) / 1000);
      setSecondsLeft(remaining > 0 ? remaining : 0);
    }, 250);

    return () => clearInterval(interval);
  }, [secondsLeft]);

  const start = useCallback((seconds: number) => {
    deadlineRef.current = Date.now() + seconds * 1000;
    setSecondsLeft(seconds);
  }, []);

  return { secondsLeft, isCoolingDown: secondsLeft > 0, start };
}
