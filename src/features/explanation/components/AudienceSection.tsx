import { audiences } from "./LandingPageData";
import { SectionHeader } from "./SectionHeader";

export function AudienceSection() {
  return (
    <section className="lp-section">
      <div className="lp-wrap">
        <SectionHeader
          title="For subjects where how and why really matter."
        />
        <div className="lp-audience lp-reveal">
          <aside>
            <p>
              The common thread is not subject or degree. It is the moment when recognising an answer
              stops being enough and you need to explain how the ideas connect.
            </p>
          </aside>
          <div className="lp-audience-grid">
            {audiences.map((audience, index) => {
              const Icon = audience.icon;
              return (
                <article className="lp-card" key={audience.title}>
                  <div className="lp-card-top">
                    <span className="fd-icon-tile">
                      <Icon size={18} strokeWidth={1.8} />
                    </span>
                    <span className="fd-kicker">{String(index + 1).padStart(2, "0")}</span>
                  </div>
                  <h3>{audience.title}</h3>
                  <p>{audience.copy}</p>
                </article>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
