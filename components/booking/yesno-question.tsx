"use client";

import { useState } from "react";

/**
 * Yes/No consultation question that reveals a follow-up detail box when the
 * answer is Yes (e.g. "Any allergies?" -> "What are you allergic to?").
 */
export function YesNoQuestion({
  name,
  required,
}: {
  name: string;
  required: boolean;
}) {
  const [value, setValue] = useState("");
  return (
    <div className="space-y-2">
      <select
        name={name}
        required={required}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        className="input cursor-pointer"
      >
        <option value="" disabled>
          Choose…
        </option>
        <option value="Yes">Yes</option>
        <option value="No">No</option>
      </select>
      {value === "Yes" && (
        <input
          name={`${name}_detail`}
          required
          placeholder="Please give details *"
          className="input animate-fade-in"
        />
      )}
    </div>
  );
}
