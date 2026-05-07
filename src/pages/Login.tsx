import React, { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { useAuth } from '@/contexts/AuthContext';
import { Loader2 } from 'lucide-react';
import { RESOLVE360_LOGO_URL } from '@/components/Logo';


const Login: React.FC = () => {
  const { signIn, user, profile, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // If a session is already present, route the user to the right place.
  // Using an effect avoids redirect loops and lets the spinner unwind cleanly.
  useEffect(() => {
    if (authLoading) return;
    if (!user) return;
    if (profile?.must_change_password) {
      navigate('/change-password', { replace: true });
    } else if (profile?.role === 'admin') {
      navigate('/admin', { replace: true });
    } else if (profile) {
      navigate('/portal', { replace: true });
    }
  }, [authLoading, user, profile, navigate]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;
    setError('');
    setLoading(true);
    try {
      const { error: err } = await signIn(email, password);
      if (err) {
        setError(err);
        return;
      }
      // Redirect happens via the effect above as soon as profile loads.
    } catch (ex: any) {
      setError(ex?.message || 'Sign-in failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const inputCls = "w-full px-4 py-3 rounded-lg border border-[#C0C0C0]/60 bg-white text-black focus:outline-none focus:border-[#D4AF37] focus:ring-2 focus:ring-[#D4AF37]/20";

  return (
    <div className="min-h-screen bg-[#FAF6EC] flex flex-col">
      <Header />
      <div className="flex-1 flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-md">
          <div className="bg-white rounded-2xl border border-[#C0C0C0]/40 p-8 shadow-sm">
            <div className="flex justify-center mb-6">
              <img
                src={RESOLVE360_LOGO_URL}
                alt="Resolve360"
                className="w-20 h-20 rounded-2xl object-contain bg-black p-1"
                draggable={false}
              />
            </div>

            <h1 className="text-2xl font-bold text-black text-center mb-2">Welcome back</h1>
            <p className="text-sm text-black/60 text-center mb-6">Sign in to your Resolve360 portal</p>
            <form onSubmit={submit} className="space-y-4" autoComplete="on">
              <div>
                <label className="block text-sm font-medium text-black mb-1.5">Email</label>
                <input type="email" autoComplete="email" className={inputCls} value={email} onChange={e => setEmail(e.target.value)} required />
              </div>
              <div>
                <label className="block text-sm font-medium text-black mb-1.5">Password</label>
                <input type="password" autoComplete="current-password" className={inputCls} value={password} onChange={e => setPassword(e.target.value)} required />
              </div>
              {error && <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">{error}</div>}
              <button
                type="submit"
                disabled={loading}
                className="w-full inline-flex items-center justify-center gap-2 px-6 py-3 rounded-lg bg-[#D4AF37] text-black font-semibold hover:bg-[#B8961F] transition disabled:opacity-50"
              >
                {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                {loading ? 'Signing in...' : 'Sign In'}
              </button>
            </form>
            <p className="text-sm text-center text-black/60 mt-6">
              New to Resolve360? <Link to="/get-started" className="text-[#A8871F] font-semibold hover:text-[#D4AF37]">Create an account</Link>
            </p>
          </div>
        </div>
      </div>
      <Footer />
    </div>
  );
};

export default Login;
