import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { Loader2 } from 'lucide-react';

const ChangePassword: React.FC = () => {
  const { user, refreshProfile } = useAuth();
  const navigate = useNavigate();
  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (pw.length < 8) { setError('Password must be at least 8 characters.'); return; }
    if (pw !== pw2) { setError('Passwords do not match.'); return; }
    setLoading(true);
    const { error: err } = await supabase.auth.updateUser({ password: pw });
    if (err) { setError(err.message); setLoading(false); return; }
    if (user) {
      await supabase.from('profiles').update({ must_change_password: false }).eq('id', user.id);
    }
    await refreshProfile();
    navigate('/portal');
  };

  const inputCls = "w-full px-4 py-3 rounded-lg border border-[#C0C0C0]/60 bg-white text-black focus:outline-none focus:border-[#D4AF37]";

  return (
    <div className="min-h-screen bg-[#FAF6EC] flex flex-col">
      <Header />
      <div className="flex-1 flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-md bg-white rounded-2xl border border-[#C0C0C0]/40 p-8">
          <h1 className="text-2xl font-bold text-black mb-2">Set a New Password</h1>
          <p className="text-sm text-black/60 mb-6">For security, please set a new password before continuing.</p>
          <form onSubmit={submit} className="space-y-4">
            <input type="password" placeholder="New password" className={inputCls} value={pw} onChange={e => setPw(e.target.value)} required />
            <input type="password" placeholder="Confirm password" className={inputCls} value={pw2} onChange={e => setPw2(e.target.value)} required />
            {error && <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">{error}</div>}
            <button disabled={loading} className="w-full inline-flex items-center justify-center gap-2 px-6 py-3 rounded-lg bg-[#D4AF37] text-black font-semibold hover:bg-[#B8961F] transition disabled:opacity-50">
              {loading && <Loader2 className="w-4 h-4 animate-spin" />}
              Update Password
            </button>
          </form>
        </div>
      </div>
      <Footer />
    </div>
  );
};

export default ChangePassword;
