"use client";

import { useActionState, useEffect, useRef } from "react";
import { ArrowRight, CheckCircle2 } from "lucide-react";
import { joinWaitlist, type WaitlistActionState } from "@src/app/waitlist/actions";
import { trackEvent } from "@src/lib/analytics";

const initialState: WaitlistActionState = {
  ok: false,
  message: "",
};

export function WaitlistForm({
  source = "landing",
}: {
  source?: string;
}) {
  const [state, formAction, pending] = useActionState(joinWaitlist, initialState);
  const trackedSuccess = useRef(false);

  useEffect(() => {
    if (!state.ok || trackedSuccess.current) return;
    trackedSuccess.current = true;
    trackEvent("waitlist_joined", { source });
  }, [source, state.ok]);

  if (state.ok) {
    return (
      <div className="waitlist-success">
        <CheckCircle2 size={24} />
        <strong>You&apos;re on the list.</strong>
        <p>{state.message}</p>
      </div>
    );
  }

  return (
    <form
      action={formAction}
      className="waitlist-form"
      onSubmit={() => trackEvent("waitlist_submit_clicked", { source })}
    >
      <input type="hidden" name="source" value={source} />
      <label>
        <span>Name</span>
        <input name="name" type="text" placeholder="Your name" />
      </label>
      <label>
        <span>School</span>
        <input name="school" type="text" placeholder="School, college, or university" />
      </label>
      <label>
        <span>Study area</span>
        <input name="studyFocus" type="text" placeholder="Medicine, CS, A-level Biology..." />
      </label>
      <label>
        <span>Email</span>
        <input name="email" type="email" placeholder="you@example.com" required />
      </label>
      <button className="button primary" type="submit" disabled={pending}>
        {pending ? "Joining..." : "Join waitlist"}
        {state.ok ? <CheckCircle2 size={16} /> : <ArrowRight size={16} />}
      </button>

      {state.message ? (
        <p className={`waitlist-message ${state.ok ? "success" : "error"}`}>{state.message}</p>
      ) : null}
    </form>
  );
}
