import { useEffect, useState } from "react";

/** A narrow window held upright (spec 0158): a phone, or a narrow desktop window. */
export const PHONE_QUERY = "(max-width: 760px) and (orientation: portrait)";

const matches = () => window.matchMedia?.(PHONE_QUERY).matches ?? false;

/** Whether the room shows its phone view, following the window as it turns or resizes. */
export function usePhoneView(): boolean {
  const [phone, setPhone] = useState(matches);
  useEffect(() => {
    const query = window.matchMedia?.(PHONE_QUERY);
    if (!query) return;
    const follow = () => setPhone(query.matches);
    follow();
    query.addEventListener("change", follow);
    return () => query.removeEventListener("change", follow);
  }, []);
  return phone;
}
