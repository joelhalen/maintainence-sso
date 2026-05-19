interface PageHeroProps {
  title: string;
  subtitle: string;
  children?: React.ReactNode;
}

export default function PageHero({ title, subtitle, children }: PageHeroProps) {
  return (
    <section className="relative overflow-hidden bg-slate-950 text-white">
      <div
        className="absolute inset-0 opacity-40"
        style={{
          backgroundImage:
            'radial-gradient(circle at 20% 50%, rgba(59,130,246,0.35) 0%, transparent 50%), radial-gradient(circle at 80% 20%, rgba(99,102,241,0.3) 0%, transparent 45%)',
        }}
      />
      <div className="relative max-w-6xl mx-auto px-4 sm:px-6 py-16 sm:py-20">
        <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight max-w-3xl">{title}</h1>
        <p className="mt-4 text-lg text-slate-300 max-w-2xl leading-relaxed">{subtitle}</p>
        {children && <div className="mt-8">{children}</div>}
      </div>
    </section>
  );
}
