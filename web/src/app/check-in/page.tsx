import { Suspense } from "react";
import { CheckIn } from "./CheckIn";

// `?event=` is read on the client, so the desk lives inside Suspense (Cache Components).
export default function CheckInPage() {
  return (
    <Suspense fallback={<div className="skeleton" style={{ minHeight: 420 }} aria-busy="true" />}>
      <CheckIn />
    </Suspense>
  );
}
