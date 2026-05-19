import PageHero from '../../components/marketing/PageHero';

interface LegalSection {
  heading: string;
  body: string[];
}

interface LegalPageProps {
  title: string;
  subtitle: string;
  lastUpdated: string;
  sections: LegalSection[];
}

export default function LegalPage({ title, subtitle, lastUpdated, sections }: LegalPageProps) {
  return (
    <>
      <PageHero title={title} subtitle={subtitle} />
      <article className="max-w-3xl mx-auto px-4 sm:px-6 py-12 sm:py-16">
        <p className="text-sm text-slate-500 mb-10">Last updated: {lastUpdated}</p>
        {sections.map((section) => (
          <section key={section.heading} className="mb-10">
            <h2 className="text-lg font-semibold text-slate-900">{section.heading}</h2>
            {section.body.map((paragraph, i) => (
              <p key={i} className="text-slate-600 leading-relaxed">
                {paragraph}
              </p>
            ))}
          </section>
        ))}
      </article>
    </>
  );
}
