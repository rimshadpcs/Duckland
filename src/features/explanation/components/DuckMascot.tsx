export type DuckMood = "idle" | "listening" | "thinking" | "asking";

// The Feynduck head as a living character: it breathes, blinks, and reacts to the
// conversation state. Eyelids are drawn over the eye whites of feynduckhead.png.
export function DuckMascot({ mood = "idle", size = 240 }: { mood?: DuckMood; size?: number }) {
  return (
    <div className={`sk-mascot is-${mood}`} style={{ width: size, height: size }} aria-hidden="true">
      <span className="sk-mascot-ring" />
      <span className="sk-mascot-ring is-late" />
      <div className="sk-mascot-body">
        <img src="/feynduckhead.png" alt="" width={1254} height={1254} />
        <span className="sk-mascot-lid is-left" />
        <span className="sk-mascot-lid is-right" />
      </div>
      <span className="sk-mascot-dots">
        <span />
        <span />
        <span />
      </span>
    </div>
  );
}
