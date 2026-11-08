"use client";

import { useCallback, useRef, useState } from "react";

/** Small transient message shown at the top of the screen. */
export function useToast() {
  const [t, setT] = useState<{ msg: string; bad: boolean } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const show = useCallback((msg: string, bad = false) => {
    setT({ msg, bad });
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setT(null), bad ? 4500 : 2400);
  }, []);
  const node = t ? <div className={`toast ${t.bad ? "bad" : ""}`} role={t.bad ? "alert" : "status"}>{t.msg}</div> : null;
  return { show, node };
}
