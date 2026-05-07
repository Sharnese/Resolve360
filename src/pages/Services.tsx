import React from 'react';
import { Link } from 'react-router-dom';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { SERVICES } from '@/lib/services';
import { CheckCircle2, ArrowRight } from 'lucide-react';

const Services: React.FC = () => {
  return (
    <div className="min-h-screen bg-[#FAF6EC]">
      <Header />
      <section className="bg-black text-[#F5EFE0] py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <p className="text-[#D4AF37] text-sm font-semibold tracking-widest uppercase mb-3">Services</p>
          <h1 className="text-4xl md:text-5xl font-bold mb-4">Comprehensive Compliance Support</h1>
          <p className="text-[#C0C0C0] max-w-2xl">From investigations to digital systems, every engagement is built to deliver clarity, compliance, and confidence.</p>
        </div>
      </section>

      <section className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-16 space-y-8">
        {SERVICES.map((s, idx) => (
          <div key={s.id} className="bg-white rounded-2xl border border-[#C0C0C0]/40 p-8 md:p-10 shadow-sm">
            <div className="grid md:grid-cols-3 gap-8">
              <div>
                <div className="text-[#D4AF37] text-xs font-semibold tracking-widest uppercase mb-2">0{idx + 1}</div>
                <h2 className="text-2xl font-bold text-black mb-3">{s.name}</h2>
                <Link to="/get-started" className="inline-flex items-center gap-1 text-sm font-semibold text-[#A8871F] hover:text-[#D4AF37]">
                  Request this service <ArrowRight className="w-4 h-4" />
                </Link>
              </div>
              <div className="md:col-span-2">
                <p className="text-black/70 leading-relaxed mb-5">{s.summary}</p>
                <h4 className="text-sm font-semibold text-black mb-3">Includes</h4>
                <ul className="grid sm:grid-cols-2 gap-2">
                  {s.includes.map((it) => (
                    <li key={it} className="flex items-start gap-2 text-sm text-black/70">
                      <CheckCircle2 className="w-4 h-4 text-[#D4AF37] mt-0.5 flex-shrink-0" />
                      <span>{it}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        ))}
      </section>

      <Footer />
    </div>
  );
};

export default Services;
