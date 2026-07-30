"use client";

import { useEffect, useState } from "react";

/** Posts the browser IANA timezone as a hidden field for signup locale prefill. */
export function SignupTimezoneField() {
  const [tz, setTz] = useState("");
  useEffect(() => {
    try {
      setTz(Intl.DateTimeFormat().resolvedOptions().timeZone || "");
    } catch {
      setTz("");
    }
  }, []);
  return <input type="hidden" name="tz" value={tz} />;
}
