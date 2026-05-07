import React from 'react';
import { Link } from 'react-router-dom';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { SERVICES } from '@/lib/services';
import { ArrowRight, CheckCircle2, ShieldCheck, FileSearch, ClipboardCheck, Cog, Monitor } from 'lucide-react';
import { RESOLVE360_LOGO_URL } from '@/components/Logo';


const ICONS: Record<string, React.ReactNode> = {
  investigation: <FileSearch className="w-6 h-6" />,
  cap: <ClipboardCheck className="w-6 h-6" />,
  documentation: <ShieldCheck className="w-6 h-6" />,
  automation: <Cog className="w-6 h-6" />,
  digital: <Monitor className="w-6 h-6" />,
};

const AppLayout: React.FC = () => {
  return (
    <div className="min-h-screen bg-[#FAF6EC]">
      <Header />

      {/* Hero */}
      <section className="relative overflow-hidden bg-gradient-to-br from-black via-[#0a0a0a] to-[#1a1410] text-[#F5EFE0]">
        <div className="absolute inset-0 opacity-20" style={{
          backgroundImage: 'radial-gradient(circle at 20% 50%, #D4AF37 0%, transparent 50%), radial-gradient(circle at 80% 80%, #C9A961 0%, transparent 50%)',
        }} />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24 md:py-32">
          <div className="grid lg:grid-cols-[1.4fr_1fr] gap-12 items-center">
            <div className="max-w-3xl">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#D4AF37]/10 border border-[#D4AF37]/30 text-[#D4AF37] text-xs font-medium mb-6">
                <span className="w-2 h-2 rounded-full bg-[#D4AF37]" /> Compliance & Investigation Consulting
              </div>
              <h1 className="text-5xl md:text-7xl font-bold tracking-tight mb-6">
                Investigate. <span className="text-[#D4AF37]">Resolve.</span> Elevate.
              </h1>
              <p className="text-lg md:text-xl text-[#C0C0C0] leading-relaxed mb-10 max-w-2xl">
                Resolve360 helps human service agencies address compliance concerns, complete certified investigations, develop corrective action plans, improve documentation, and build smarter systems.
              </p>
              <div className="flex flex-col sm:flex-row gap-4">
                <Link
                  to="/get-started"
                  className="inline-flex items-center justify-center gap-2 px-8 py-4 rounded-lg bg-[#D4AF37] text-black font-semibold hover:bg-[#B8961F] transition shadow-lg shadow-[#D4AF37]/20"
                >
                  Get Started <ArrowRight className="w-4 h-4" />
                </Link>
                <Link
                  to="/login"
                  className="inline-flex items-center justify-center gap-2 px-8 py-4 rounded-lg border border-[#C9A961]/50 text-[#F5EFE0] font-semibold hover:bg-[#D4AF37]/10 transition"
                >
                  Client Login
                </Link>
              </div>
            </div>
            <div className="hidden lg:flex justify-center">
              <img
                src={RESOLVE360_LOGO_URL}
                alt="Resolve360"
                className="w-full max-w-sm aspect-square object-contain rounded-3xl bg-black shadow-2xl shadow-[#D4AF37]/20 ring-1 ring-[#D4AF37]/30"
                draggable={false}
              />
            </div>
          </div>
        </div>
      </section>


      {/* Services preview */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <div className="text-center mb-14">
          <p className="text-[#D4AF37] text-sm font-semibold tracking-widest uppercase mb-3">Our Services</p>
          <h2 className="text-4xl md:text-5xl font-bold text-black mb-4">Built for Agencies That Lead</h2>
          <p className="text-lg text-black/60 max-w-2xl mx-auto">
            Five specialized practices designed to keep your agency compliant, efficient, and resilient.
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {SERVICES.map((s) => (
            <div
              key={s.id}
              className="group bg-white rounded-2xl border border-[#C0C0C0]/40 p-7 hover:border-[#D4AF37] hover:shadow-xl hover:shadow-[#D4AF37]/10 transition-all"
            >
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#D4AF37] to-[#A8871F] flex items-center justify-center text-black mb-5">
                {ICONS[s.id]}
              </div>
              <h3 className="text-xl font-semibold text-black mb-3">{s.name}</h3>
              <p className="text-sm text-black/60 leading-relaxed mb-5">{s.summary.slice(0, 140)}...</p>
              <ul className="space-y-2 mb-6">
                {s.includes.slice(0, 3).map((it) => (
                  <li key={it} className="flex items-start gap-2 text-sm text-black/70">
                    <CheckCircle2 className="w-4 h-4 text-[#D4AF37] mt-0.5 flex-shrink-0" />
                    <span>{it}</span>
                  </li>
                ))}
              </ul>
              <Link to="/services" className="inline-flex items-center gap-1 text-sm font-semibold text-[#A8871F] hover:text-[#D4AF37]">
                Learn more <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          ))}
        </div>
      </section>

      {/* CTA strip */}
      <section className="bg-black text-[#F5EFE0]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 text-center">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">Ready to resolve with confidence?</h2>
          <p className="text-[#C0C0C0] mb-8 max-w-xl mx-auto">Submit a request and our team will review your needs and follow up with next steps.</p>
          <Link
            to="/get-started"
            className="inline-flex items-center gap-2 px-8 py-4 rounded-lg bg-[#D4AF37] text-black font-semibold hover:bg-[#B8961F] transition"
          >
            Start a Request <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </section>

      <Footer />
    </div>
  );
};

export default AppLayout;
