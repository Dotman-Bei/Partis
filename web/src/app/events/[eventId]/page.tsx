import { Suspense } from "react";
import { EventDetailRoute } from "./EventDetail";

// Params are only known at request time; the Suspense boundary lets Next prerender the shell
// (Cache Components) while the event itself is read from BOT Chain on the client.
export default function EventDetailPage({ params }: PageProps<"/events/[eventId]">) {
  return (
    <Suspense fallback={<div className="skeleton" style={{ minHeight: 420 }} aria-busy="true" />}>
      <EventDetailRoute params={params} />
    </Suspense>
  );
}
