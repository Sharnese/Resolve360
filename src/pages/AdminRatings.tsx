import React, { useEffect, useState } from 'react';
import { Navigate, Link } from 'react-router-dom';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { Loader2, Star, Check, X, Trash2, ArrowLeft } from 'lucide-react';

interface Rating {
  id: string;
  person_name: string;
  rating: number;
  comment: string | null;
  status: string;
  created_at: string;
  reviewed_at: string | null;
}

/**
 * Admin moderation dashboard for the public ratings system.
 * Lists every rating with name, stars, comment, submission date, and status.
 * Admin can approve, reject, or delete a rating. Only approved ratings show on the
 * public site (the public list filters by status='approved').
 */
const AdminRatings: React.FC = () => {
  const { user, profile, loading } = useAuth();
  const [items, setItems] = useState<Rating[]>([]);
  const [busy, setBusy] = useState(true);
  const [filter, setFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('all');

  const load = async () => {
    setBusy(true);
    const { data } = await supabase
      .from('ratings')
      .select('*')
      .order('created_at', { ascending: false });
    setItems((data as Rating[]) || []);
    setBusy(false);
  };

  useEffect(() => {
    load();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-[#D4AF37]" />
      </div>
    );
  }
  if (!user) return <Navigate to="/login" />;
  if (profile?.role !== 'admin') return <Navigate to="/portal" />;

  const setStatus = async (id: string, status: 'approved' | 'rejected') => {
    await supabase
      .from('ratings')
      .update({ status, reviewed_at: new Date().toISOString(), reviewed_by: user.id })
      .eq('id', id);
    load();
  };

  const remove = async (id: string) => {
    if (!confirm('Permanently delete this rating? This cannot be undone.')) return;
    await supabase.from('ratings').delete().eq('id', id);
    load();
  };

  const filtered = items.filter((r) => filter === 'all' || r.status === filter);

  const counts = {
    all: items.length,
    pending: items.filter((r) => r.status === 'pending').length,
    approved: items.filter((r) => r.status === 'approved').length,
    rejected: items.filter((r) => r.status === 'rejected').length,
  };

  const tabs: { id: typeof filter; label: string; count: number }[] = [
    { id: 'all', label: 'All', count: counts.all },
    { id: 'pending', label: 'Pending', count: counts.pending },
    { id: 'approved', label: 'Approved', count: counts.approved },
    { id: 'rejected', label: 'Rejected', count: counts.rejected },
  ];

  return (
    <div className="min-h-screen bg-[#FAF6EC]">
      <Header />
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <Link to="/admin" className="inline-flex items-center gap-1 text-sm font-semibold text-[#A8871F] hover:text-[#D4AF37] mb-4">
          <ArrowLeft className="w-4 h-4" /> Back to Dashboard
        </Link>

        <div className="mb-6">
          <p className="text-[#D4AF37] text-sm font-semibold tracking-widest uppercase mb-2">Admin</p>
          <h1 className="text-3xl font-bold text-black">Ratings & Reviews</h1>
          <p className="text-sm text-black/60 mt-1">
            Approve, reject, or delete public reviews. Only approved reviews appear on the public site.
          </p>
        </div>

        {/* Tabs */}
        <div className="flex flex-wrap gap-2 mb-6">
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setFilter(t.id)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition border ${
                filter === t.id
                  ? 'bg-black text-[#D4AF37] border-black'
                  : 'bg-white text-black border-[#C0C0C0]/60 hover:border-[#D4AF37]'
              }`}
            >
              {t.label} <span className="opacity-70">({t.count})</span>
            </button>
          ))}
        </div>

        {/* Table */}
        {busy ? (
          <Loader2 className="w-6 h-6 animate-spin text-[#D4AF37]" />
        ) : filtered.length === 0 ? (
          <div className="bg-white rounded-2xl border border-dashed border-[#C0C0C0]/60 p-10 text-center text-black/60">
            No ratings in this view.
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-[#C0C0C0]/40 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px]">
                <thead className="bg-[#FAF6EC] border-b border-[#C0C0C0]/40">
                  <tr className="text-left text-xs uppercase tracking-wide text-black/60">
                    <th className="px-4 py-3">Person</th>
                    <th className="px-4 py-3">Rating</th>
                    <th className="px-4 py-3">Comment</th>
                    <th className="px-4 py-3">Submitted</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((r) => (
                    <tr key={r.id} className="border-b border-[#C0C0C0]/30 align-top">
                      <td className="px-4 py-3 text-sm font-medium text-black">{r.person_name}</td>
                      <td className="px-4 py-3 text-sm">
                        <div className="inline-flex items-center gap-0.5">
                          {[1, 2, 3, 4, 5].map((n) => (
                            <Star
                              key={n}
                              width={14}
                              height={14}
                              className={n <= r.rating ? 'fill-[#D4AF37] text-[#D4AF37]' : 'text-[#C0C0C0]'}
                            />
                          ))}
                          <span className="ml-1 text-xs text-black/60">{r.rating}/5</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-black/70 max-w-md">
                        {r.comment || <span className="text-black/40">—</span>}
                      </td>
                      <td className="px-4 py-3 text-xs text-black/60 whitespace-nowrap">
                        {new Date(r.created_at).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium border ${
                            r.status === 'approved'
                              ? 'bg-green-50 border-green-200 text-green-800'
                              : r.status === 'rejected'
                              ? 'bg-red-50 border-red-200 text-red-700'
                              : 'bg-amber-50 border-amber-200 text-amber-800'
                          }`}
                        >
                          {r.status}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-2">
                          {r.status !== 'approved' && (
                            <button
                              onClick={() => setStatus(r.id, 'approved')}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-green-600 text-white hover:bg-green-700"
                              title="Approve"
                            >
                              <Check className="w-3.5 h-3.5" /> Approve
                            </button>
                          )}
                          {r.status !== 'rejected' && (
                            <button
                              onClick={() => setStatus(r.id, 'rejected')}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold border border-[#C0C0C0]/60 text-black hover:border-red-400 hover:text-red-700"
                              title="Reject"
                            >
                              <X className="w-3.5 h-3.5" /> Reject
                            </button>
                          )}
                          <button
                            onClick={() => remove(r.id)}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold border border-red-200 text-red-700 hover:bg-red-50"
                            title="Delete"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
      <Footer />
    </div>
  );
};

export default AdminRatings;
