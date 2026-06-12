import { universities } from "./LandingPageData";

export function UniversityMarquee() {
  const loop = [...universities, ...universities];

  return (
    <section className="university-strip reveal" aria-label="University social proof">
      <p>Loved by students from</p>
      <div className="university-marquee">
        <div className="university-track">
          {loop.map((school, index) => (
            <span key={`${school}-${index}`}>{school}</span>
          ))}
        </div>
      </div>
    </section>
  );
}
