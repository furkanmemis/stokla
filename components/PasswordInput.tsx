"use client";

import { useState } from "react";

/** Password field with a show/hide toggle, so people can check what they typed on a phone keyboard. */
export function PasswordInput({ id, name, label, autoComplete, hint }: {
  id: string; name: string; label: string; autoComplete: "current-password" | "new-password"; hint?: string;
}) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="field">
      <label htmlFor={id}>{label}{hint && <span className="hint"> {hint}</span>}</label>
      <div className="password">
        <input className="input" id={id} name={name} type={visible ? "text" : "password"} autoComplete={autoComplete} required
          minLength={autoComplete === "new-password" ? 8 : undefined} maxLength={72} />
        <button type="button" onClick={() => setVisible(!visible)} aria-pressed={visible} aria-controls={id}>
          {visible ? "Gizle" : "Göster"}
        </button>
      </div>
    </div>
  );
}
