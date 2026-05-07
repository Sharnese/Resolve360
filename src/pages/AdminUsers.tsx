import React, { useEffect, useState } from 'react';
import { Navigate, Link } from 'react-router-dom';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { ArrowLeft, Loader2, Plus, Trash2, KeyRound } from 'lucide-react';

const AdminUsers: React.FC = () => {
  const { user, profile, loading } = useAuth();
  const [users, setUsers] = useState<any[]>([]);
  const [profiles, setProfiles] = useState<any[]>([]);
  const [companies, setCompanies] = useState<any[]>([]);
  const [busy, setBusy] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createMsg, setCreateMsg] = useState('');
  const [form, setForm] = useState({
    email: '', companyName: '', website: '', address: '',
    firstName: '', lastName: '', phone: '',
  });

  const tempPassword = () => Math.random().toString(36).slice(-10) + 'A1!';

  const load = async () => {
    setBusy(true);
    const { data } = await supabase.functions.invoke('resolve360-admin', {
      body: { action: 'list_users' },
    });
    setUsers(data?.users || []);
    setProfiles(data?.profiles || []);
    setCompanies(data?.companies || []);
    setBusy(false);
  };

  useEffect(() => { load(); }, []);

  if (loading) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="w-6 h-6 animate-spin text-[#D4AF37]" /></div>;
  if (!user) return <Navigate to="/login" />;
  if (profile?.role !== 'admin') return <Navigate to="/portal" />;

  const createClient = async () => {
    if (!form.email || !form.companyName || !form.firstName || !form.lastName) return;
    setCreating(true);
    setCreateMsg('');
    const password = tempPassword();
    const { data, error } = await supabase.functions.invoke('resolve360-admin', {
      body: {
        action: 'create_client',
        payload: {
          email: form.email,
          password,
          company: {
            company_name: form.companyName,
            website: form.website || null,
            address: form.address,
            primary_contact_first_name: form.firstName,
            primary_contact_last_name: form.lastName,
            phone: form.phone,
          },
        },
      },
    });
    setCreating(false);
    if (error || data?.error) {
      setCreateMsg('Error: ' + (data?.error || error?.message || 'Unknown'));
    } else {
      setCreateMsg(`Client created. Temporary password: ${password}`);
      setForm({ email: '', companyName: '', website: '', address: '', firstName: '', lastName: '', phone: '' });
      await load();
    }
  };

  const deleteUser = async (uid: string) => {
    if (!confirm('Delete this user? This cannot be undone.')) return;
    await supabase.functions.invoke('resolve360-admin', {
      body: { action: 'delete_user', payload: { userId: uid } },
    });
    await load();
  };

  const sendReset = async (email: string) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email);
    alert(error ? 'Error: ' + error.message : 'Reset link sent to ' + email);
  };

  const inputCls = "w-full px-3 py-2 rounded-lg border border-[#C0C0C0]/60 bg-white text-sm";

  return (
    <div className="min-h-screen bg-[#FAF6EC]">
      <Header />
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <Link to="/admin" className="inline-flex items-center gap-1 text-sm text-black/60 hover:text-black mb-4">
          <ArrowLeft className="w-4 h-4" /> Back to dashboard
        </Link>
        <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
          <h1 className="text-3xl font-bold text-black">User Management</h1>
          <button onClick={() => setShowCreate(!showCreate)} className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-[#D4AF37] text-black font-semibold hover:bg-[#B8961F]">
            <Plus className="w-4 h-4" /> Create Client
          </button>
        </div>

        {showCreate && (
          <section className="bg-white rounded-2xl border border-[#C0C0C0]/40 p-6 mb-6">
            <h2 className="text-lg font-semibold text-black mb-4">New Client</h2>
            <div className="grid sm:grid-cols-2 gap-3">
              <input className={inputCls} placeholder="Email *" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} />
              <input className={inputCls} placeholder="Phone *" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} />
              <input className={inputCls} placeholder="Company Name *" value={form.companyName} onChange={e => setForm({ ...form, companyName: e.target.value })} />
              <input className={inputCls} placeholder="Website" value={form.website} onChange={e => setForm({ ...form, website: e.target.value })} />
              <input className={inputCls + ' sm:col-span-2'} placeholder="Address *" value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} />
              <input className={inputCls} placeholder="First Name *" value={form.firstName} onChange={e => setForm({ ...form, firstName: e.target.value })} />
              <input className={inputCls} placeholder="Last Name *" value={form.lastName} onChange={e => setForm({ ...form, lastName: e.target.value })} />
            </div>
            <div className="mt-4 flex items-center gap-3">
              <button onClick={createClient} disabled={creating} className="px-5 py-2.5 rounded-lg bg-[#D4AF37] text-black font-semibold hover:bg-[#B8961F] disabled:opacity-50">
                {creating ? 'Creating...' : 'Create & Generate Temp Password'}
              </button>
              {createMsg && <span className="text-sm text-black/70">{createMsg}</span>}
            </div>
          </section>
        )}

        {busy ? <Loader2 className="w-6 h-6 animate-spin text-[#D4AF37]" /> : (
          <div className="bg-white rounded-2xl border border-[#C0C0C0]/40 overflow-hidden">
            <table className="w-full">
              <thead className="bg-[#FAF6EC] border-b border-[#C0C0C0]/40">
                <tr className="text-left text-xs uppercase tracking-wide text-black/60">
                  <th className="px-4 py-3">Email</th>
                  <th className="px-4 py-3">Role</th>
                  <th className="px-4 py-3">Company</th>
                  <th className="px-4 py-3">Must Change PW</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {users.map(u => {
                  const p = profiles.find(x => x.id === u.id);
                  const co = companies.find(c => c.user_id === u.id);
                  return (
                    <tr key={u.id} className="border-b border-[#C0C0C0]/30 hover:bg-[#FAF6EC]/50">
                      <td className="px-4 py-3 text-sm text-black">{u.email}</td>
                      <td className="px-4 py-3 text-sm">
                        <span className={`px-2 py-1 rounded text-xs font-semibold ${p?.role === 'admin' ? 'bg-black text-[#D4AF37]' : 'bg-[#D4AF37]/20 text-[#7a6010]'}`}>{p?.role || 'client'}</span>
                      </td>
                      <td className="px-4 py-3 text-sm text-black">{co?.company_name || '—'}</td>
                      <td className="px-4 py-3 text-sm">{p?.must_change_password ? 'Yes' : 'No'}</td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex justify-end gap-2">
                          <button onClick={() => sendReset(u.email)} className="text-sm text-[#A8871F] hover:text-[#D4AF37] inline-flex items-center gap-1">
                            <KeyRound className="w-4 h-4" /> Reset
                          </button>
                          {p?.role !== 'admin' && (
                            <button onClick={() => deleteUser(u.id)} className="text-sm text-red-600 hover:text-red-800 inline-flex items-center gap-1">
                              <Trash2 className="w-4 h-4" /> Delete
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
      <Footer />
    </div>
  );
};

export default AdminUsers;
