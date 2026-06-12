import { landingFeatures } from "./LandingPageData";
import { SectionHeader } from "./SectionHeader";

export function ProductFeaturesSection() {
  return (
    <section className="section product-features">
      <SectionHeader
        label="what you get"
        title="Everything points back to one question: can you explain it?"
        copy="Feynduck keeps the workspace focused on source material, your explanation, and the missing reasoning link."
      />
      <div className="feature-grid reveal">
        {landingFeatures.map((feature) => {
          const Icon = feature.icon;
          return (
            <article className="feature-card" key={feature.title}>
              <span>
                <Icon size={18} />
              </span>
              <h3>{feature.title}</h3>
              <p>{feature.copy}</p>
            </article>
          );
        })}
      </div>
    </section>
  );
}
