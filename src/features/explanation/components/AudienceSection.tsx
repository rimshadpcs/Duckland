import { audiences } from "./LandingPageData";
import { SectionHeader } from "./SectionHeader";

export function AudienceSection() {
  return (
    <section className="section audience-section">
      <SectionHeader
        label="who it's for"
        title="Good grades can still hide weak understanding."
        copy="Feynduck is for the moment recognition stops being enough: a blank page, a viva, a harder question, an interview, a placement, or the first day on the job."
      />
      <div className="audience-field-notes reveal">
        <aside className="audience-ledger">
          <span>Field notes</span>
          <p>
            The common thread is not subject or degree. It is the uneasy point where recognition
            stops being enough and the student has to explain the mechanism out loud.
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
