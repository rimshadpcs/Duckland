import { audiences } from "./LandingPageData";
import { SectionHeader } from "./SectionHeader";

export function AudienceSection() {
  return (
    <section className="section audience-section">
      <SectionHeader
        label="who it's for"
        title="For subjects where how and why really matter."
        copy="Built for medicine, science, engineering, law—and anyone studying ideas they need to truly understand."
      />
      <div className="audience-field-notes reveal">
        <aside className="audience-ledger">
          <span>Field notes</span>
          <p>
            The common thread is not subject or degree. It is the moment when recognising an answer
            stops being enough and you need to explain how the ideas connect.
          </p>
        </aside>
        <div className="audience-note-grid">
          {audiences.map((audience, index) => {
            const Icon = audience.icon;
            return (
              <article className="audience-card" key={audience.title}>
                <span>
                  <Icon size={18} />
                </span>
                <small>{String(index + 1).padStart(2, "0")}</small>
                <h3>{audience.title}</h3>
                <p>{audience.copy}</p>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}
