import React from 'react';
import { Link } from 'react-router-dom';
import Logo from '@/components/Logo';

const Footer: React.FC = () => {
  return (
    <footer className="bg-black text-[#F5EFE0] border-t border-[#C9A961]/30 mt-16">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 grid md:grid-cols-3 gap-8">
        <div>
          <div className="mb-3">
            <Logo size={56} />
          </div>
          <p className="text-sm text-[#C0C0C0]">Compliance, investigation, training, and digital solutions for human service agencies.</p>
        </div>

        <div>
          <h4 className="text-sm font-semibold mb-3 text-[#D4AF37]">Navigate</h4>
          <ul className="space-y-2 text-sm text-[#C0C0C0]">
            <li><Link to="/" className="hover:text-[#D4AF37]">Home</Link></li>
            <li><Link to="/services" className="hover:text-[#D4AF37]">Services</Link></li>
            <li><Link to="/get-started" className="hover:text-[#D4AF37]">Get Started</Link></li>
            <li><Link to="/login" className="hover:text-[#D4AF37]">Client Login</Link></li>
          </ul>
        </div>
        <div>
          <h4 className="text-sm font-semibold mb-3 text-[#D4AF37]">Contact</h4>
          <p className="text-sm text-[#C0C0C0]">Sharnese Jones</p>
          <p className="text-sm text-[#C0C0C0]">Resolve360 Consulting</p>
        </div>
      </div>
      <div className="border-t border-[#C9A961]/20 py-4 text-center text-xs text-[#C0C0C0]">
        © {new Date().getFullYear()} Resolve360. All rights reserved.
      </div>
    </footer>
  );
};

export default Footer;
