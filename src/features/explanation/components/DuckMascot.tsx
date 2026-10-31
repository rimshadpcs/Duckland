export type DuckMood = "idle" | "listening" | "thinking" | "asking";

// The Feynduck mascot as a living character: it breathes, blinks, and reacts to the
// conversation state. "head" is the logo duck; "full" is the waving full-body duck.
// Eyelids are drawn in the duck's own yellow over the eye whites of each image.
export function DuckMascot({
  mood = "idle",
  size = 240,
  variant = "head",
}: {
  mood?: DuckMood;
  size?: number;
  variant?: "head" | "full";
}) {
  const isFull = variant === "full";

  return (
    <div
      className={`sk-mascot is-${mood} is-${variant}`}
      style={{ width: size, height: isFull ? size * 1.5 : size }}
      aria-hidden="true"
    >
      <span className="sk-mascot-ring" />
      <span className="sk-mascot-ring is-late" />
      <div className="sk-mascot-body">
        <img
          src={isFull ? "/feynduck-mascot.webp" : "/feynduckhead.png"}
          alt=""
          width={isFull ? 512 : 1254}
          height={isFull ? 768 : 1254}
        />
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
