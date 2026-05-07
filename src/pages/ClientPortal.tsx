import React, { useEffect, useState } from 'react';
import { Navigate, Link } from 'react-router-dom';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import StatusBadge from '@/components/StatusBadge';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import {
  ArrowRight, Loader2, FileText, Sparkles, Edit3, Save, X,
  Building2, FileSignature, CheckCircle2,
} from 'lucide-react';
import { computeContractStatus } from '@/lib/contract';

/**
 * ClientPortal
 * ------------
 * Bug being fixed (May 2026): Previously this page only loaded service requests
 * tied to `profile.company_id` — but each new request was inserting a brand-new
 * company row and overwriting `profile.company_id`, so users only saw their
 * MOST RECENT request and historical requests appeared "lost".
 *
 * Fix: We now load EVERY company associated with this user's email, then load
 * EVERY service_request whose company_id is in that set. Requests are sorted
 * newest → oldest. The user's "primary" company profile is the most recently
 * created company on file (so users can review/edit it). Going forward,
 * GetStarted reuses this primary company instead of creating a new one — but
 * historical duplicates still show up correctly here.
 */

const ClientPortal: React.FC = () => {
  const { user, profile, loading } = useAuth();
  const [primaryCompany, setPrimaryCompany] = useState<any>(null);
  const [allCompanyIds, setAllCompanyIds] = useState<string[]>([]);
  const [requests, setRequests] = useState<any[]>([]);
  const [contracts, setContracts] = useState<any[]>([]);
  const [busy, setBusy] = useState(true);

  // Inline company-profile editor
  const [editing, setEditing] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);
  const [companyDraft, setCompanyDraft] = useState<any>({});

  const reload = async () => {
    if (!user) return;
    setBusy(true);

    // 1) Find every company associated with this user.
    //    (a) anything whose email matches the user, plus
    //    (b) the company the profile currently points at, if any.
    const ids = new Set<string>();
    let companies: any[] = [];

    if (user.email) {
      const { data: byEmail } = await supabase
        .from('companies')
        .select('*')
        .eq('email', user.email)
        .order('created_at', { ascending: false });
      (byEmail || []).forEach(c => { companies.push(c); ids.add(c.id); });
    }

    if (profile?.company_id && !ids.has(profile.company_id)) {
      const { data: pinned } = await supabase
        .from('companies')
        .select('*')
        .eq('id', profile.company_id)
        .maybeSingle();
      if (pinned) { companies.push(pinned); ids.add(pinned.id); }
    }

    setAllCompanyIds(Array.from(ids));
    // Prefer the company the profile currently points at; otherwise the newest.
    const primary =
      (profile?.company_id && companies.find(c => c.id === profile.company_id)) ||
      companies[0] ||
      null;
    setPrimaryCompany(primary);
    setCompanyDraft(primary || {});

    // 2) Load every service request belonging to ANY of those companies.
    if (ids.size > 0) {
      const { data: reqs } = await supabase
        .from('service_requests')
        .select('*')
        .in('company_id', Array.from(ids))
        .order('created_at', { ascending: false });
      const reqList = reqs || [];
      setRequests(reqList);

      if (reqList.length > 0) {
        const reqIds = reqList.map(r => r.id);
        const { data: cts } = await supabase
          .from('contracts')
          .select('*')
          .in('request_id', reqIds);
        setContracts(cts || []);
      } else {
        setContracts([]);
      }
    } else {
      setRequests([]);
      setContracts([]);
    }
    setBusy(false);
  };

  useEffect(() => {
    if (!user) return;
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, profile?.company_id]);

  if (loading) return <div className="min-h-screen flex items-center justify-center bg-[#FAF6EC]"><Loader2 className="w-6 h-6 animate-spin text-[#D4AF37]" /></div>;
  if (!user) return <Navigate to="/login" />;
  if (profile?.must_change_password) return <Navigate to="/change-password" />;
  if (profile?.role === 'admin') return <Navigate to="/admin" />;

  const firstName = profile?.first_name || primaryCompany?.primary_contact_first_name || user.email?.split('@')[0];
  const latest = requests[0];

  const nextStepFor = (status: string, isInv: boolean) => {
    if (!isInv) return 'Resolve360 will review your request and follow up.';
    switch (status) {
      case 'New Request':
      case 'Pending Review': return 'Awaiting review by Resolve360.';
      case 'Proposal Sent': return 'Review and e-sign your contract.';
      case 'Change Requested': return 'Resolve360 is updating your contract.';
      case 'Proposal Signed':
      case 'Assigning Investigator': return 'Investigator is being assigned.';
      case 'Investigator Assigned':
      case 'In Progress': return 'Investigation in progress.';
      case 'Investigation Complete': return 'Final report available.';
      default: return '';
    }
  };

  // Look up the active contract status label for a request (used in the table).
  const contractStatusFor = (requestId: string): string | null => {
    const reqContracts = contracts.filter(c => c.request_id === requestId);
    if (reqContracts.length === 0) return null;
    const active = reqContracts.find(c => c.is_active_version) || reqContracts[0];
    return computeContractStatus(active);
  };

  const saveCompanyProfile = async () => {
    if (!primaryCompany) return;
    setSavingProfile(true);
    await supabase.from('companies').update({
      company_name: companyDraft.company_name,
      website: companyDraft.website || null,
      address: companyDraft.address,
      primary_contact_first_name: companyDraft.primary_contact_first_name,
      primary_contact_last_name: companyDraft.primary_contact_last_name,
      phone: companyDraft.phone,
      updated_at: new Date().toISOString(),
    }).eq('id', primaryCompany.id);
    setSavingProfile(false);
    setEditing(false);
    await reload();
  };

  return (
    <div className="min-h-screen bg-[#FAF6EC]">
      <Header />
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="mb-8">
          <p className="text-[#D4AF37] text-sm font-semibold tracking-widest uppercase mb-2">Client Portal</p>
          <h1 className="text-3xl font-bold text-black">Welcome{firstName ? `, ${firstName}` : ''}</h1>
          <p className="text-black/60 text-sm mt-1">Here's an overview of your Resolve360 requests.</p>
        </div>

        {busy ? <Loader2 className="w-6 h-6 animate-spin text-[#D4AF37]" /> : (
          <>
            {/* Dashboard Overview */}
            {latest ? (
              <div className="grid md:grid-cols-3 gap-4 mb-8">
                <div className="md:col-span-2 bg-black text-[#F5EFE0] rounded-2xl p-6 border border-[#D4AF37]/40 relative overflow-hidden">
                  <div className="absolute -right-8 -top-8 w-32 h-32 bg-[#D4AF37]/15 rounded-full blur-2xl" />
                  <div className="relative">
                    <p className="text-xs uppercase tracking-widest text-[#D4AF37] font-semibold mb-1">Current Request</p>
                    <h2 className="text-xl font-bold mb-2">{latest.investigation_title || latest.selected_services?.[0] || 'Service Request'}</h2>
                    <p className="text-sm text-[#F5EFE0]/70 mb-3">{(latest.selected_services || []).join(', ')}</p>
                    <div className="flex items-center gap-3 mb-4">
                      <StatusBadge status={latest.status} />
                      <span className="text-xs text-[#F5EFE0]/60">{latest.request_id}</span>
                    </div>
                    <p className="text-sm text-[#F5EFE0]/80 flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-[#D4AF37]" />
                      {nextStepFor(latest.status, latest.selected_services?.includes('Certified Investigation ODP'))}
                    </p>
                    <Link to={`/portal/request/${latest.id}`} className="inline-flex items-center gap-1 mt-4 px-4 py-2 rounded-lg bg-[#D4AF37] text-black text-sm font-semibold hover:bg-[#B8961F] transition">
                      Open Request <ArrowRight className="w-4 h-4" />
                    </Link>
                  </div>
                </div>
                <div className="bg-white rounded-2xl border border-[#C0C0C0]/40 p-6">
                  <p className="text-xs uppercase tracking-widest text-[#D4AF37] font-semibold mb-2">Quick Stats</p>
                  <div className="space-y-3 text-sm">
                    <div className="flex items-center justify-between">
                      <span className="text-black/60">Total Requests</span>
                      <span className="text-black font-bold text-lg">{requests.length}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-black/60">In Progress</span>
                      <span className="text-black font-bold text-lg">{requests.filter(r => !['Investigation Complete'].includes(r.status)).length}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-black/60">Completed</span>
                      <span className="text-black font-bold text-lg">{requests.filter(r => r.status === 'Investigation Complete').length}</span>
                    </div>
                  </div>
                  <Link to="/get-started" className="mt-4 inline-flex w-full items-center justify-center gap-1 px-4 py-2 rounded-lg border border-[#C0C0C0]/60 text-black text-sm font-semibold hover:border-[#D4AF37]">
                    + New Request
                  </Link>
                </div>
              </div>
            ) : (
              <div className="bg-white rounded-2xl border border-[#C0C0C0]/40 p-8 text-center mb-8">
                <FileText className="w-10 h-10 text-[#D4AF37] mx-auto mb-3" />
                <h2 className="text-lg font-semibold text-black mb-1">No requests yet</h2>
                <p className="text-black/60 mb-4">Submit your first request to get started.</p>
                <Link to="/get-started" className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-[#D4AF37] text-black font-semibold hover:bg-[#B8961F] transition">
                  Submit a Request <ArrowRight className="w-4 h-4" />
                </Link>
              </div>
            )}

            <div className="grid lg:grid-cols-3 gap-6">
              {/* Profile (editable) */}
              <div className="lg:col-span-1 bg-white rounded-2xl border border-[#C0C0C0]/40 p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-semibold text-black inline-flex items-center gap-2">
                    <Building2 className="w-4 h-4 text-[#D4AF37]" /> Company Profile
                  </h2>
                  {primaryCompany && !editing && (
                    <button
                      onClick={() => { setEditing(true); setCompanyDraft(primaryCompany); }}
                      className="text-xs text-[#A8871F] hover:text-[#D4AF37] inline-flex items-center gap-1"
                    >
                      <Edit3 className="w-3 h-3" /> Edit
                    </button>
                  )}
                </div>

                {!primaryCompany ? (
                  <p className="text-sm text-black/60">Submit your first request to create a company profile.</p>
                ) : !editing ? (
                  <>
                    <dl className="space-y-3 text-sm">
                      <div><dt className="text-black/50 text-xs uppercase tracking-wide">Company</dt><dd className="text-black font-medium">{primaryCompany.company_name}</dd></div>
                      <div><dt className="text-black/50 text-xs uppercase tracking-wide">Website</dt><dd className="text-black">{primaryCompany.website || '—'}</dd></div>
                      <div><dt className="text-black/50 text-xs uppercase tracking-wide">Address</dt><dd className="text-black">{primaryCompany.address}</dd></div>
                      <div><dt className="text-black/50 text-xs uppercase tracking-wide">Primary Contact</dt><dd className="text-black">{primaryCompany.primary_contact_first_name} {primaryCompany.primary_contact_last_name}</dd></div>
                      <div><dt className="text-black/50 text-xs uppercase tracking-wide">Phone</dt><dd className="text-black">{primaryCompany.phone}</dd></div>
                      <div><dt className="text-black/50 text-xs uppercase tracking-wide">Email</dt><dd className="text-black">{primaryCompany.email}</dd></div>
                    </dl>
                    <p className="text-[11px] text-black/40 mt-4">
                      Future requests will reuse this profile automatically. Click Edit to update it.
                    </p>
                  </>
                ) : (
                  <div className="space-y-3 text-sm">
                    {[
                      { k: 'company_name', label: 'Company Name' },
                      { k: 'website', label: 'Website' },
                      { k: 'address', label: 'Address' },
                      { k: 'primary_contact_first_name', label: 'Contact First Name' },
                      { k: 'primary_contact_last_name', label: 'Contact Last Name' },
                      { k: 'phone', label: 'Phone' },
                    ].map(f => (
                      <div key={f.k}>
                        <label className="text-[11px] uppercase tracking-wide text-black/50">{f.label}</label>
                        <input
                          value={companyDraft[f.k] || ''}
                          onChange={e => setCompanyDraft({ ...companyDraft, [f.k]: e.target.value })}
                          className="w-full mt-1 px-3 py-2 rounded-lg border border-[#C0C0C0]/60 bg-white focus:outline-none focus:border-[#D4AF37]"
                        />
                      </div>
                    ))}
                    <div className="flex items-center gap-2 pt-2">
                      <button
                        onClick={saveCompanyProfile}
                        disabled={savingProfile}
                        className="inline-flex items-center gap-1 px-4 py-2 rounded-lg bg-[#D4AF37] text-black text-sm font-semibold hover:bg-[#B8961F] disabled:opacity-50"
                      >
                        {savingProfile ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                        {savingProfile ? 'Saving...' : 'Save'}
                      </button>
                      <button
                        onClick={() => { setEditing(false); setCompanyDraft(primaryCompany); }}
                        className="inline-flex items-center gap-1 px-3 py-2 rounded-lg border border-[#C0C0C0]/60 bg-white text-black text-sm hover:border-[#D4AF37]"
                      >
                        <X className="w-4 h-4" /> Cancel
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Requests history */}
              <div className="lg:col-span-2 space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-semibold text-black">List of My Requests</h2>
                  <span className="text-xs text-black/50">
                    Showing {requests.length} request{requests.length === 1 ? '' : 's'} · newest first
                  </span>
                </div>

                {requests.length === 0 && (
                  <div className="bg-white rounded-2xl border border-[#C0C0C0]/40 p-6 text-center text-sm text-black/60">
                    No requests yet.
                  </div>
                )}

                {requests.length > 0 && (
                  <div className="bg-white rounded-2xl border border-[#C0C0C0]/40 overflow-hidden">
                    <div className="overflow-x-auto">
                      <table className="w-full min-w-[640px] text-sm">
                        <thead className="bg-[#FAF6EC] border-b border-[#C0C0C0]/40">
                          <tr className="text-left text-xs uppercase tracking-wide text-black/60">
                            <th className="px-4 py-3">Request ID</th>
                            <th className="px-4 py-3">Service Type</th>
                            <th className="px-4 py-3">Submitted</th>
                            <th className="px-4 py-3">Status</th>
                            <th className="px-4 py-3">Contract</th>
                            <th className="px-4 py-3"></th>
                          </tr>
                        </thead>
                        <tbody>
                          {requests.map(r => {
                            const cs = contractStatusFor(r.id);
                            return (
                              <tr key={r.id} className="border-b border-[#C0C0C0]/30 hover:bg-[#FAF6EC]/50">
                                <td className="px-4 py-3">
                                  <div className="font-mono text-xs text-black/70">{r.request_id}</div>
                                  <div className="text-[11px] text-black/40">{r.investigation_title || ''}</div>
                                </td>
                                <td className="px-4 py-3 text-black">{(r.selected_services || []).join(', ') || '—'}</td>
                                <td className="px-4 py-3 text-black/70 text-xs">
                                  {new Date(r.created_at).toLocaleDateString()}
                                </td>
                                <td className="px-4 py-3"><StatusBadge status={r.status} /></td>
                                <td className="px-4 py-3 text-xs">
                                  {cs ? (
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full border border-[#C0C0C0]/60 bg-[#FAF6EC] text-black/70">
                                      <FileSignature className="w-3 h-3 text-[#D4AF37]" /> {cs}
                                    </span>
                                  ) : (
                                    <span className="text-black/40">—</span>
                                  )}
                                </td>
                                <td className="px-4 py-3 text-right">
                                  <Link
                                    to={`/portal/request/${r.id}`}
                                    className="inline-flex items-center gap-1 text-xs font-semibold text-[#A8871F] hover:text-[#D4AF37]"
                                  >
                                    View <ArrowRight className="w-3 h-3" />
                                  </Link>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {allCompanyIds.length > 1 && (
                  <p className="text-[11px] text-black/40 inline-flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3 text-green-600" />
                    Showing requests across {allCompanyIds.length} company profile{allCompanyIds.length === 1 ? '' : 's'} on your account.
                  </p>
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

export default ClientPortal;
