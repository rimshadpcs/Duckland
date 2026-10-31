export function SectionHeader({
  label,
  title,
  copy,
}: {
  label?: string;
  title: string;
  copy?: string;
}) {
  return (
    <div className="lp-head lp-reveal">
      {label ? <p className="fd-eyebrow is-amber">{label}</p> : null}
      <h2>{title}</h2>
      {copy ? <p>{copy}</p> : null}
    </div>
  );
}
