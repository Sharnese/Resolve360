import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { LogOut } from 'lucide-react';
import NotificationsBell from '@/components/NotificationsBell';
import Logo from '@/components/Logo';

const Header: React.FC = () => {
  const { user, profile, signOut } = useAuth();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    try {
      await signOut();
    } finally {
      // Use replace so the back button can't return to a protected page.
      navigate('/login', { replace: true });
    }
  };


  return (
    <header className="sticky top-0 z-40 bg-black border-b border-[#C9A961]/30">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <Link to="/" className="flex items-center group" aria-label="Resolve360 home">
            <Logo size={44} />
          </Link>


          <nav className="hidden md:flex items-center gap-8">
            <Link to="/" className="text-sm text-[#F5EFE0] hover:text-[#D4AF37] transition">Home</Link>
            <Link to="/services" className="text-sm text-[#F5EFE0] hover:text-[#D4AF37] transition">Services</Link>
            <Link to="/get-started" className="text-sm text-[#F5EFE0] hover:text-[#D4AF37] transition">Get Started</Link>
            {user && profile?.role === 'admin' && (
              <Link to="/admin" className="text-sm text-[#D4AF37] hover:text-[#F5EFE0] transition">Admin</Link>
            )}
            {user && profile?.role === 'client' && (
              <Link to="/portal" className="text-sm text-[#D4AF37] hover:text-[#F5EFE0] transition">Portal</Link>
            )}
          </nav>

          <div className="flex items-center gap-2">
            {!user ? (
              <>
                <Link
                  to="/login"
                  className="hidden sm:inline-flex px-4 py-2 text-sm font-medium rounded-lg border border-[#C9A961]/40 text-[#F5EFE0] hover:bg-[#D4AF37]/10 transition"
                >
                  Sign In
                </Link>
                <Link
                  to="/get-started"
                  className="px-4 py-2 text-sm font-medium rounded-lg bg-[#D4AF37] text-black hover:bg-[#B8961F] transition"
                >
                  Get Started
                </Link>
              </>
            ) : (
              <>
                <NotificationsBell />
                <button
                  onClick={handleSignOut}
                  className="flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg border border-[#C9A961]/40 text-[#F5EFE0] hover:bg-[#D4AF37]/10 transition"
                >
                  <LogOut className="w-4 h-4" /> Sign Out
                </button>
              </>
            )}

          </div>

        </div>
      </div>
    </header>
  );
};

export default Header;
