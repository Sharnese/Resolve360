import React, { useEffect, useMemo, useState } from 'react';
import { Navigate, Link } from 'react-router-dom';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import StatusBadge from '@/components/StatusBadge';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import {
  Loader2, Users, ArrowRight, Search, FileSignature, FileCheck2, ClipboardList, Activity,
  FilePlus, Upload, CheckCircle2, Star,
} from 'lucide-react';
import { STATUS_FLOW, SERVICE_NAMES } from '@/lib/services';


const AdminDashboard: React.FC = () => {
  const { user, profile, loading } = useAuth();
  const [requests, setRequests] = useState<any[]>([]);
  const [companies, setCompanies] = useState<any[]>([]);
  const [contracts, setContracts] = useState<any[]>([]);
  const [docs, setDocs] = useState<any[]>([]);
  const [reports, setReports] = useState<any[]>([]);
  const [usersCount, setUsersCount] = useState<number>(0);
  const [filterService, setFilterService] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterCompany, setFilterCompany] = useState('');
  const [search, setSearch] = useState('');
  const [sortNewest, setSortNewest] = useState(true);
  const [busy, setBusy] = useState(true);

  useEffect(() => {
    (async () => {
      const [r, c, ct, d, fr] = await Promise.all([
        supabase.from('service_requests').select('*').order('created_at', { ascending: false }),
        supabase.from('companies').select('*'),
        supabase.from('contracts').select('*').order('created_at', { ascending: false }),
        supabase.from('investigation_documents').select('*').order('created_at', { ascending: false }),
        supabase.from('final_reports').select('*').order('created_at', { ascending: false }),
      ]);
      setRequests(r.data || []);
      setCompanies(c.data || []);
      setContracts(ct.data || []);
      setDocs(d.data || []);
      setReports(fr.data || []);

      // user count via admin function
      const { data: u } = await supabase.functions.invoke('resolve360-admin', { body: { action: 'list_users' } });
      setUsersCount((u?.users || []).length);

      setBusy(false);
    })();
  }, []);
  // ---- Derived data ----
  // IMPORTANT: All hooks (useMemo / useEffect / useState) must run on every
  // render. Previously the early returns below sat *between* useEffect and
  // these useMemo calls, so when the user signed out (user → null) we
  // returned <Navigate> *before* calling useMemo, producing fewer hooks than
  // the previous render and triggering React error #300/#310 ("Rendered
  // fewer hooks than expected"). Keep all hook calls above any conditional
  // return.
  const companyById = (id: string) => companies.find(c => c.id === id);

  const filtered = useMemo(() => {
    let list = [...requests];
    if (filterService) list = list.filter(r => (r.selected_services || []).includes(filterService));
    if (filterStatus) list = list.filter(r => r.status === filterStatus);
    if (filterCompany) list = list.filter(r => companies.find(c => c.id === r.company_id)?.company_name?.toLowerCase().includes(filterCompany.toLowerCase()));
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(r => {
        const co = companies.find(c => c.id === r.company_id);
        return (
          (r.request_id || '').toLowerCase().includes(q) ||
          (r.investigation_title || '').toLowerCase().includes(q) ||
          (r.description || '').toLowerCase().includes(q) ||
          (co?.company_name || '').toLowerCase().includes(q) ||
          (co?.primary_contact_first_name || '').toLowerCase().includes(q) ||
          (co?.primary_contact_last_name || '').toLowerCase().includes(q) ||
          (co?.email || '').toLowerCase().includes(q)
        );
      });
    }
    list.sort((a, b) => {
      const da = new Date(a.created_at).getTime();
      const db = new Date(b.created_at).getTime();
      return sortNewest ? db - da : da - db;
    });
    return list;
  }, [requests, companies, filterService, filterStatus, filterCompany, search, sortNewest]);

  // Recent activity feed (most recent 8 items mixed)
  const activity = useMemo(() => {
    const events: { type: string; label: string; sub?: string; ts: string; href?: string; icon: any }[] = [];
    const findCo = (cid: string) => companies.find(c => c.id === cid);
    requests.slice(0, 5).forEach(r => {
      const co = findCo(r.company_id);
      events.push({
        type: 'new', label: 'New request submitted',
        sub: `${co?.company_name || 'Client'} — ${r.investigation_title || r.selected_services?.[0] || 'Service'}`,
        ts: r.created_at, href: `/admin/request/${r.id}`, icon: FilePlus,
      });
    });
    contracts.filter(c => c.client_signature).slice(0, 5).forEach(c => {
      const r = requests.find(x => x.id === c.request_id);
      const co = r ? findCo(r.company_id) : null;
      events.push({
        type: 'signed', label: 'Contract signed by client',
        sub: co?.company_name || 'Client',
        ts: c.signed_at || c.updated_at || c.created_at,
        href: r ? `/admin/request/${r.id}` : undefined, icon: FileSignature,
      });
    });
    docs.slice(0, 5).forEach(d => {
      const r = requests.find(x => x.id === d.request_id);
      const co = r ? findCo(r.company_id) : null;
      events.push({
        type: 'doc', label: 'Document uploaded',
        sub: `${co?.company_name || 'Client'} — ${d.file_name}`,
        ts: d.created_at, href: r ? `/admin/request/${r.id}` : undefined, icon: Upload,
      });
    });
    reports.slice(0, 5).forEach(rep => {
      const r = requests.find(x => x.id === rep.request_id);
      const co = r ? findCo(r.company_id) : null;
      events.push({
        type: 'complete', label: 'Final report uploaded',
        sub: `${co?.company_name || 'Client'} — ${rep.file_name}`,
        ts: rep.created_at, href: r ? `/admin/request/${r.id}` : undefined, icon: CheckCircle2,
      });
    });
    return events.sort((a, b) => new Date(b.ts).getTime() - new Date(a.ts).getTime()).slice(0, 8);
  }, [requests, contracts, docs, reports, companies]);

  // ---- Conditional renders (must come AFTER all hook calls) ----
  if (loading) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="w-6 h-6 animate-spin text-[#D4AF37]" /></div>;
  if (!user) return <Navigate to="/login" />;
  if (profile?.role !== 'admin') return <Navigate to="/portal" />;

  const countBy = (s: string) => requests.filter(r => r.status === s).length;

  const cards = [
    { key: 'all', label: 'Total Requests', val: requests.length, color: 'bg-black text-[#D4AF37]' },
    { key: 'New Request', label: 'New Requests', val: countBy('New Request') },
    { key: 'Pending Review', label: 'Pending Review', val: countBy('Pending Review') },
    { key: 'Proposal Sent', label: 'Proposal Sent', val: countBy('Proposal Sent') },
    { key: 'Change Requested', label: 'Change Requested', val: countBy('Change Requested'), color: 'bg-orange-50' },
    { key: 'Proposal Signed', label: 'Proposal Signed', val: countBy('Proposal Signed') },
    { key: 'Assigning Investigator', label: 'Assigning Investigator', val: countBy('Assigning Investigator') },
    { key: 'Investigator Assigned', label: 'Investigator Assigned', val: countBy('Investigator Assigned') },
    { key: 'In Progress', label: 'In Progress', val: countBy('In Progress') },
    { key: 'Investigation Complete', label: 'Investigation Complete', val: countBy('Investigation Complete') },
    { key: 'users', label: 'Total Users', val: usersCount, color: 'bg-[#D4AF37] text-black', link: '/admin/users' as const },
  ];


  return (
    <div className="min-h-screen bg-[#FAF6EC]">
      <Header />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-8">
          <div>
            <p className="text-[#D4AF37] text-sm font-semibold tracking-widest uppercase mb-2">Admin Portal</p>
            <h1 className="text-3xl font-bold text-black">Dashboard</h1>
            <p className="text-sm text-black/60 mt-1">Manage every Resolve360 request, contract, and client from one place.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link to="/admin/ratings" className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-[#C0C0C0]/60 bg-white text-black hover:border-[#D4AF37]">
              <Star className="w-4 h-4" /> Ratings
            </Link>
            <Link to="/admin/users" className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-[#C0C0C0]/60 bg-white text-black hover:border-[#D4AF37]">
              <Users className="w-4 h-4" /> Users
            </Link>
          </div>

        </div>

        {busy ? <Loader2 className="w-6 h-6 animate-spin text-[#D4AF37]" /> : (
          <>
            {/* Summary cards */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 mb-8">
              {cards.map(c => {
                const isActive = c.key === 'all' ? (!filterStatus) : filterStatus === c.key;
                if (c.key === 'users') {
                  return (
                    <Link key={c.key} to="/admin/users"
                      className={`rounded-xl border border-[#C0C0C0]/40 p-4 hover:border-[#D4AF37] transition ${c.color || 'bg-white'}`}>
                      <div className="text-3xl font-bold">{c.val}</div>
                      <div className="text-xs mt-1 opacity-80">{c.label}</div>
                    </Link>
                  );
                }
                return (
                  <button key={c.key}
                    onClick={() => setFilterStatus(c.key === 'all' ? '' : c.key)}
                    className={`text-left rounded-xl border p-4 transition ${isActive ? 'border-[#D4AF37] ring-2 ring-[#D4AF37]/30' : 'border-[#C0C0C0]/40'} ${c.color || 'bg-white'} hover:border-[#D4AF37]`}>
                    <div className="text-3xl font-bold">{c.val}</div>
                    <div className="text-xs mt-1 opacity-80">{c.label}</div>
                  </button>
                );
              })}
            </div>

            <div className="grid lg:grid-cols-3 gap-6 mb-6">
              {/* Service Requests: header + filters + table in ONE unified card */}
              <div className="lg:col-span-2 bg-white rounded-2xl border border-[#C0C0C0]/40 overflow-hidden flex flex-col">
                {/* Header */}
                <div className="flex items-center gap-2 px-4 pt-4">
                  <ClipboardList className="w-4 h-4 text-[#D4AF37]" />
                  <h2 className="font-semibold text-black">Service Requests</h2>
                  <span className="text-xs text-black/50 ml-auto">{filtered.length} shown</span>
                </div>

                {/* Filters */}
                <div className="px-4 pt-3 pb-4 border-b border-[#C0C0C0]/30">
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
                    <div className="relative sm:col-span-2 lg:col-span-2">
                      <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-black/40" />
                      <input
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        placeholder="Search requests, companies, contacts…"
                        className="w-full pl-9 pr-3 py-2 rounded-lg border border-[#C0C0C0]/60 bg-white text-sm focus:outline-none focus:border-[#D4AF37]"
                      />
                    </div>
                    <select value={filterService} onChange={e => setFilterService(e.target.value)} className="px-3 py-2 rounded-lg border border-[#C0C0C0]/60 bg-white text-sm">
                      <option value="">All Services</option>
                      {SERVICE_NAMES.map(s => <option key={s}>{s}</option>)}
                    </select>
                    <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className="px-3 py-2 rounded-lg border border-[#C0C0C0]/60 bg-white text-sm">
                      <option value="">All Statuses</option>
                      {STATUS_FLOW.map(s => <option key={s}>{s}</option>)}
                    </select>
                    <input
                      value={filterCompany}
                      onChange={e => setFilterCompany(e.target.value)}
                      placeholder="Filter by company"
                      className="px-3 py-2 rounded-lg border border-[#C0C0C0]/60 bg-white text-sm"
                    />
                    <select value={sortNewest ? 'new' : 'old'} onChange={e => setSortNewest(e.target.value === 'new')} className="px-3 py-2 rounded-lg border border-[#C0C0C0]/60 bg-white text-sm">
                      <option value="new">Newest first</option>
                      <option value="old">Oldest first</option>
                    </select>
                  </div>
                </div>

                {/* Table */}
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[860px]">
                    <thead className="bg-[#FAF6EC] border-b border-[#C0C0C0]/40">
                      <tr className="text-left text-xs uppercase tracking-wide text-black/60">
                        <th className="px-4 py-3">Request</th>
                        <th className="px-4 py-3">Company</th>
                        <th className="px-4 py-3">Contact</th>
                        <th className="px-4 py-3">Services</th>
                        <th className="px-4 py-3">Status</th>
                        <th className="px-4 py-3">Submitted</th>
                        <th className="px-4 py-3"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {filtered.map(r => {
                        const co = companyById(r.company_id);
                        return (
                          <tr key={r.id} className="border-b border-[#C0C0C0]/30 hover:bg-[#FAF6EC]/50">
                            <td className="px-4 py-3 text-sm">
                              <div className="font-medium text-black">{r.investigation_title || r.selected_services?.[0] || 'Request'}</div>
                              <div className="text-xs text-black/50">{r.request_id}</div>
                            </td>
                            <td className="px-4 py-3 text-sm text-black">{co?.company_name || '—'}</td>
                            <td className="px-4 py-3 text-xs text-black/70">
                              {co ? <>
                                <div>{co.primary_contact_first_name} {co.primary_contact_last_name}</div>
                                <div className="text-black/50">{co.email}</div>
                              </> : '—'}
                            </td>
                            <td className="px-4 py-3 text-xs text-black/70">{(r.selected_services || []).join(', ')}</td>
                            <td className="px-4 py-3"><StatusBadge status={r.status} /></td>
                            <td className="px-4 py-3 text-xs text-black/60">{new Date(r.created_at).toLocaleDateString()}</td>
                            <td className="px-4 py-3 text-right">
                              <Link to={`/admin/request/${r.id}`} className="inline-flex items-center gap-1 text-sm font-semibold text-[#A8871F] hover:text-[#D4AF37]">
                                View <ArrowRight className="w-4 h-4" />
                              </Link>
                            </td>
                          </tr>
                        );
                      })}
                      {filtered.length === 0 && (
                        <tr><td colSpan={7} className="text-center py-10 text-black/50 text-sm">No requests found.</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Recent activity */}
              <div className="bg-white rounded-2xl border border-[#C0C0C0]/40 p-4 self-start">
                <div className="flex items-center gap-2 mb-3">
                  <Activity className="w-4 h-4 text-[#D4AF37]" />
                  <h2 className="font-semibold text-black">Recent Activity</h2>
                </div>
                {activity.length === 0 ? (
                  <p className="text-sm text-black/50">No recent activity.</p>
                ) : (
                  <ul className="space-y-2">
                    {activity.map((e, i) => {
                      const Icon = e.icon;
                      const Body = (
                        <div className="flex items-start gap-3 p-2 rounded-lg hover:bg-[#FAF6EC] transition">
                          <div className="w-8 h-8 rounded-lg bg-[#FAF6EC] border border-[#C0C0C0]/40 flex items-center justify-center flex-shrink-0">
                            <Icon className="w-4 h-4 text-[#A8871F]" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-sm text-black font-medium truncate">{e.label}</p>
                            {e.sub && <p className="text-xs text-black/60 truncate">{e.sub}</p>}
                            <p className="text-[11px] text-black/40">{new Date(e.ts).toLocaleString()}</p>
                          </div>
                        </div>
                      );
                      return e.href ? (
                        <li key={i}><Link to={e.href}>{Body}</Link></li>
                      ) : <li key={i}>{Body}</li>;
                    })}
                  </ul>
                )}
              </div>
            </div>

          </>
        )}
      </div>
      <Footer />
    </div>
  );
};

export default AdminDashboard;
