import { audiences } from "./LandingPageData";
import { SectionHeader } from "./SectionHeader";

export function AudienceSection() {
  return (
    <section className="section audience-section">
      <SectionHeader
        label="who it's for"
        title="Built for students who can't afford fake confidence."
        copy="Feynduck is for students who put in the hours but still feel unsure when they have to explain, reason, or apply the material."
      />
      <div className="audience-grid reveal">
        {audiences.map((audience) => {
          const Icon = audience.icon;
          return (
            <article className="audience-card" key={audience.title}>
              <span>
                <Icon size={18} />
              </span>
              <h3>{audience.title}</h3>
              <p>{audience.copy}</p>
            </article>
          );
        })}
      </div>
    </section>
  );
}
