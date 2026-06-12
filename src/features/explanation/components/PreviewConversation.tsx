export function PreviewConversation({
  active,
  typedDuck,
  typedUser,
  typedFollowup,
  gapVisible,
  score,
}: {
  active: number;
  typedDuck: string;
  typedUser: string;
  typedFollowup: string;
  gapVisible: boolean;
  score: number;
}) {
  if (active === 0) {
    return (
      <div className="preview-chat">
        <p className="bubble duck-bubble with-duck">Add what your class actually covered, and I&apos;ll use it to check your explanation.</p>
      </div>
    );
  }

  if (active === 2) {
    return (
      <div className="preview-chat">
        <p className="bubble student-bubble">Oxygen is needed for respiration, so I guess oxygen keeps it going.</p>
        {typedFollowup ? <p className="bubble duck-bubble">{typedFollowup}</p> : null}
      </div>
    );
  }

  if (active === 3) {
    return (
      <div className="preview-chat">
        <p className="bubble duck-bubble">Want to turn this gap into practice?</p>
      </div>
    );
  }

  if (active === 4) {
    return (
      <div className="preview-chat">
        <p className="bubble duck-bubble">You&apos;re getting clearer.</p>
      </div>
    );
  }

  return (
    <div className="preview-chat">
      <p className="bubble duck-bubble with-duck">{typedDuck || "Explain why the Krebs cycle needs oxygen, even though oxygen is not directly used in the cycle."}</p>
      {(typedFollowup || gapVisible) ? (
        <p className="bubble student-bubble">The Krebs cycle makes energy by breaking glucose down and passing electrons to carriers. Oxygen is needed later, so without oxygen the cycle just stops.</p>
      ) : null}
      {(typedFollowup || gapVisible) ? (
        <p className="bubble duck-bubble">{typedFollowup || "You're close. What happens to NADH if oxygen is unavailable?"}</p>
      ) : null}
      {gapVisible ? (
        <div className="gap-alert">
          <strong>Gap detected · Clarity {score}</strong>
          <p>You explained what happens but not why it stops. The causal link is missing.</p>
        </div>
      ) : null}
    </div>
  );
}
