// Hand-drawn strokes that match the line weight of the Feynduck illustrations.
// Each path draws itself in once its section is revealed (see landing-sketch.css).

export function HandUnderline() {
  return (
    <svg className="sk-underline sk-draw" viewBox="0 0 300 24" preserveAspectRatio="none" aria-hidden="true">
      <path d="M4 15 C 52 8, 104 18, 158 12 S 252 7, 296 13" pathLength={1} />
    </svg>
  );
}

export function HandCircle() {
  return (
    <svg className="sk-circle sk-draw" viewBox="0 0 400 100" preserveAspectRatio="none" aria-hidden="true">
      <path
        d="M34 12 C 128 1, 300 3, 376 17 C 404 30, 398 80, 358 91 C 258 103, 92 101, 26 87 C -2 76, 2 30, 44 10 L 76 5"
        pathLength={1}
      />
    </svg>
  );
}
