export function Duck({ className = "" }: { className?: string }) {
  return (
    <span className={`duck ${className}`} aria-label="Feynduck mascot" role="img">
      <img src="/feynduckhead.png" alt="" />
    </span>
  );
}
