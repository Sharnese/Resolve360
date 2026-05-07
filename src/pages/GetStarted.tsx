import React, { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { SERVICE_NAMES } from '@/lib/services';
import { supabase } from '@/lib/supabase';
import { sendNotification } from '@/lib/notify';
import { useAuth } from '@/contexts/AuthContext';
import { Loader2, UserPlus, ClipboardList, Plus, Trash2, Building2, CheckCircle2 } from 'lucide-react';

const TIMELINE_OPTIONS = ['ASAP', 'Within 2 Weeks', 'Within 30 Days', 'Flexible'];

interface AvailabilitySlot {
  date: string;
  startTime: string;
  endTime: string;
}


const inputCls = "w-full px-4 py-3 rounded-lg border border-[#C0C0C0]/60 bg-white text-black focus:outline-none focus:border-[#D4AF37] focus:ring-2 focus:ring-[#D4AF37]/20 transition";
const labelCls = "block text-sm font-medium text-black mb-1.5";

const SignupStep: React.FC<{ onDone: (firstName: string, lastName: string, email: string) => void }> = ({ onDone }) => {
  const { signUp } = useAuth();
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!firstName || !lastName || !email || !password) {
      setError('Please complete all required fields.');
      return;
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    if (password !== confirm) {
      setError('Passwords do not match.');
      return;
    }
    setLoading(true);
    const { error: err } = await signUp(email, password, firstName, lastName);
    if (err) {
      setError(err);
      setLoading(false);
      return;
    }

    fetch('https://famous.ai/api/crm/69fa082fcb06d3abce43dd96/subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email,
        name: `${firstName} ${lastName}`,
        source: 'get-started-signup',
        tags: ['signup', 'resolve360'],
      }),
    }).catch(() => {});

    sendNotification('account_created', null, {
      contactName: `${firstName} ${lastName}`,
      contactEmail: email,
    });

    setLoading(false);
    onDone(firstName, lastName, email);
  };

  return (
    <div className="bg-white rounded-2xl border border-[#C0C0C0]/40 p-6 md:p-8">
      <div className="flex items-center gap-3 mb-2">
        <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-[#D4AF37] to-[#A8871F] flex items-center justify-center">
          <UserPlus className="w-5 h-5 text-black" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-black">Step 1 — Create your account</h2>
          <p className="text-sm text-black/60">You'll need an account to submit and track your request.</p>
        </div>
      </div>
      <div className="h-px bg-[#C0C0C0]/40 my-5" />
      <form onSubmit={submit} className="space-y-4">
        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <label className={labelCls}>First Name *</label>
            <input className={inputCls} value={firstName} onChange={e => setFirstName(e.target.value)} required />
          </div>
          <div>
            <label className={labelCls}>Last Name *</label>
            <input className={inputCls} value={lastName} onChange={e => setLastName(e.target.value)} required />
          </div>
        </div>
        <div>
          <label className={labelCls}>Email *</label>
          <input type="email" className={inputCls} value={email} onChange={e => setEmail(e.target.value)} required />
        </div>
        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <label className={labelCls}>Password * <span className="text-black/40 font-normal">(8+ chars)</span></label>
            <input type="password" className={inputCls} value={password} onChange={e => setPassword(e.target.value)} required minLength={8} />
          </div>
          <div>
            <label className={labelCls}>Confirm Password *</label>
            <input type="password" className={inputCls} value={confirm} onChange={e => setConfirm(e.target.value)} required />
          </div>
        </div>
        {error && <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">{error}</div>}
        <button
          type="submit"
          disabled={loading}
          className="w-full inline-flex items-center justify-center gap-2 px-6 py-3 rounded-lg bg-[#D4AF37] text-black font-semibold hover:bg-[#B8961F] transition disabled:opacity-50"
        >
          {loading && <Loader2 className="w-4 h-4 animate-spin" />}
          Create Account & Continue
        </button>
        <p className="text-sm text-center text-black/60">
          Already have an account? <Link to="/login" className="text-[#A8871F] font-semibold hover:text-[#D4AF37]">Sign in</Link>
        </p>
      </form>
    </div>
  );
};

const GetStarted: React.FC = () => {
  const { user, profile, refreshProfile } = useAuth();
  const navigate = useNavigate();

  // Existing company profile (if user already onboarded). When this is set we
  // SKIP the company-info form on follow-up requests instead of forcing the
  // user to retype it (and we never insert a duplicate company row).
  const [existingCompany, setExistingCompany] = useState<any>(null);
  const [companyChecked, setCompanyChecked] = useState(false);

  // Company fields (only used for first-time onboarding).
  const [companyName, setCompanyName] = useState('');
  const [website, setWebsite] = useState('');
  const [address, setAddress] = useState('');
  const [phone, setPhone] = useState('');

  // Request fields
  const [services, setServices] = useState<string[]>([]);
  const [investigationTitle, setInvestigationTitle] = useState('');
  const [description, setDescription] = useState('');
  const [timeline, setTimeline] = useState('');
  const [availSlots, setAvailSlots] = useState<AvailabilitySlot[]>([
    { date: '', startTime: '', endTime: '' },
  ]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  // On mount (once authenticated) check whether this user already has a
  // company profile on file. If so, we reuse it and hide the company section.
  useEffect(() => {
    let cancelled = false;
    const lookup = async () => {
      if (!user) { setCompanyChecked(true); return; }
      let comp: any = null;
      if (profile?.company_id) {
        const { data } = await supabase
          .from('companies')
          .select('*')
          .eq('id', profile.company_id)
          .maybeSingle();
        comp = data || null;
      }
      if (!comp && user.email) {
        const { data } = await supabase
          .from('companies')
          .select('*')
          .eq('email', user.email)
          .order('created_at', { ascending: false })
          .limit(1);
        comp = (data && data[0]) || null;
        if (comp && !profile?.company_id) {
          // Backfill profile.company_id so future loads are fast.
          await supabase.from('profiles').update({ company_id: comp.id }).eq('id', user.id);
        }
      }
      if (cancelled) return;
      setExistingCompany(comp);
      setCompanyChecked(true);
    };
    lookup();
    return () => { cancelled = true; };
  }, [user, profile?.company_id]);

  const toggleService = (s: string) => {
    setServices(prev => prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s]);
  };

  const needsInvestigationTitle = services.includes('Certified Investigation ODP');

  if (!user) {
    return (
      <div className="min-h-screen bg-[#FAF6EC]">
        <Header />
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="mb-8">
            <p className="text-[#D4AF37] text-sm font-semibold tracking-widest uppercase mb-3">Get Started</p>
            <h1 className="text-4xl font-bold text-black mb-2">Let's get your request started</h1>
            <p className="text-black/60">Create your account and we'll guide you through the intake form on the next step.</p>
          </div>
          <ol className="flex items-center gap-2 text-xs text-black/60 mb-6">
            <li className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#D4AF37]/15 border border-[#D4AF37]/40 text-black font-semibold">1. Create Account</li>
            <li className="text-black/30">→</li>
            <li className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white border border-[#C0C0C0]/60">2. Submit Request</li>
            <li className="text-black/30">→</li>
            <li className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white border border-[#C0C0C0]/60">3. Track in Dashboard</li>
          </ol>
          <SignupStep onDone={() => { /* refresh handled by AuthContext */ }} />
        </div>
        <Footer />
      </div>
    );
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (services.length === 0) {
      setError('Please select at least one service.');
      return;
    }
    // Only require company fields if the user has no existing profile.
    if (!existingCompany) {
      if (!companyName || !address || !phone) {
        setError('Please complete company information.');
        return;
      }
    }
    if (needsInvestigationTitle && !investigationTitle) {
      setError('Investigation Title is required.');
      return;
    }
    setSubmitting(true);
    try {
      const firstName = profile?.first_name || (user.user_metadata?.first_name) || '';
      const lastName = profile?.last_name || (user.user_metadata?.last_name) || '';
      const email = user.email;

      // ---- Company: reuse if it exists, otherwise create exactly once. ----
      let companyId: string;
      if (existingCompany) {
        // Reuse the existing company. We do NOT overwrite the user's saved
        // company info from the request form (the request form doesn't even
        // collect it in this branch). Edits live on the Client Portal.
        companyId = existingCompany.id;
      } else {
        const { data: company, error: cErr } = await supabase.from('companies').insert({
          company_name: companyName,
          website: website || null,
          address,
          primary_contact_first_name: firstName,
          primary_contact_last_name: lastName,
          phone,
          email,
        }).select().single();
        if (cErr) throw cErr;
        companyId = company.id;
        // Pin this company onto the user's profile so future requests reuse it.
        await supabase.from('profiles').update({ company_id: company.id }).eq('id', user.id);
        await refreshProfile();
      }

      // ---- Service request: ALWAYS insert a new row. Never overwrite. ----
      const requestId = `R360-${Date.now().toString(36).toUpperCase()}`;
      const cleanedSlots = availSlots.filter(s => s.date && s.startTime);
      const legacyAvailability = cleanedSlots[0]
        ? new Date(`${cleanedSlots[0].date}T${cleanedSlots[0].startTime || '09:00'}`).toISOString()
        : null;

      const { data: insertedReq, error: rErr } = await supabase.from('service_requests').insert({
        request_id: requestId,
        company_id: companyId,
        selected_services: services,
        investigation_title: needsInvestigationTitle ? investigationTitle : null,
        description,
        desired_start_timeline: timeline,
        availability_datetime: legacyAvailability,
        availability_options: cleanedSlots.length ? cleanedSlots : null,
        status: 'New Request',
      }).select().single();
      if (rErr) throw rErr;

      if (insertedReq?.id) {
        sendNotification('request_submitted', insertedReq.id);
      }

      navigate('/portal');
    } catch (err: any) {
      setError(err.message || 'Submission failed.');
    } finally {
      setSubmitting(false);
    }
  };

  if (profile?.role === 'admin') {
    navigate('/admin');
    return null;
  }

  return (
    <div className="min-h-screen bg-[#FAF6EC]">
      <Header />
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="mb-8">
          <p className="text-[#D4AF37] text-sm font-semibold tracking-widest uppercase mb-3">Get Started</p>
          <h1 className="text-4xl font-bold text-black mb-2">Tell us about your needs</h1>
          <p className="text-black/60">Signed in as <span className="font-medium text-black">{user.email}</span></p>
        </div>
        <ol className="flex items-center gap-2 text-xs text-black/60 mb-6 flex-wrap">
          <li className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#D4AF37]/10 border border-[#C0C0C0]/60 text-black/70">1. Create Account ✓</li>
          <li className="text-black/30">→</li>
          <li className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#D4AF37]/15 border border-[#D4AF37]/40 text-black font-semibold">2. Submit Request</li>
          <li className="text-black/30">→</li>
          <li className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white border border-[#C0C0C0]/60">3. Track in Dashboard</li>
        </ol>

        {!companyChecked ? (
          <div className="bg-white rounded-2xl border border-[#C0C0C0]/40 p-8 text-center">
            <Loader2 className="w-6 h-6 animate-spin text-[#D4AF37] mx-auto" />
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-8">
            {existingCompany ? (
              /* Returning user — reuse existing company profile. */
              <section className="bg-white rounded-2xl border border-[#C0C0C0]/40 p-6 md:p-8">
                <div className="flex items-center gap-2 mb-1">
                  <Building2 className="w-5 h-5 text-[#D4AF37]" />
                  <h2 className="text-lg font-semibold text-black">Company Information</h2>
                  <span className="ml-auto inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border border-green-200 bg-green-50 text-green-800 font-medium">
                    <CheckCircle2 className="w-3 h-3" /> Using saved profile
                  </span>
                </div>
                <p className="text-sm text-black/60 mb-4">
                  We pulled your company details from your account. You won't need to re-enter them for new requests.
                </p>
                <div className="grid sm:grid-cols-2 gap-3 text-sm p-4 rounded-lg border border-[#C0C0C0]/40 bg-[#FAF6EC]">
                  <div><dt className="text-[11px] uppercase text-black/50">Company</dt><dd className="text-black font-medium">{existingCompany.company_name}</dd></div>
                  <div><dt className="text-[11px] uppercase text-black/50">Phone</dt><dd className="text-black">{existingCompany.phone}</dd></div>
                  <div className="sm:col-span-2"><dt className="text-[11px] uppercase text-black/50">Address</dt><dd className="text-black">{existingCompany.address}</dd></div>
                  {existingCompany.website && (
                    <div className="sm:col-span-2"><dt className="text-[11px] uppercase text-black/50">Website</dt><dd className="text-black">{existingCompany.website}</dd></div>
                  )}
                  <div><dt className="text-[11px] uppercase text-black/50">Primary Contact</dt><dd className="text-black">{existingCompany.primary_contact_first_name} {existingCompany.primary_contact_last_name}</dd></div>
                  <div><dt className="text-[11px] uppercase text-black/50">Email</dt><dd className="text-black">{existingCompany.email}</dd></div>
                </div>
                <p className="text-xs text-black/50 mt-3">
                  Need to update this info? <Link to="/portal" className="text-[#A8871F] font-semibold hover:text-[#D4AF37]">Edit your company profile</Link>.
                </p>
              </section>
            ) : (
              /* First-time user — collect company info once. */
              <section className="bg-white rounded-2xl border border-[#C0C0C0]/40 p-6 md:p-8">
                <div className="flex items-center gap-2 mb-1">
                  <ClipboardList className="w-5 h-5 text-[#D4AF37]" />
                  <h2 className="text-lg font-semibold text-black">Company Information</h2>
                </div>
                <p className="text-sm text-black/60 mb-4">
                  We'll save this once and reuse it for any future requests.
                </p>
                <div className="h-px bg-[#C0C0C0]/40 my-4" />
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="md:col-span-2">
                    <label className={labelCls}>Company Name *</label>
                    <input className={inputCls} value={companyName} onChange={e => setCompanyName(e.target.value)} required />
                  </div>
                  <div>
                    <label className={labelCls}>Company Website</label>
                    <input className={inputCls} value={website} onChange={e => setWebsite(e.target.value)} placeholder="https://" />
                  </div>
                  <div>
                    <label className={labelCls}>Address *</label>
                    <input className={inputCls} value={address} onChange={e => setAddress(e.target.value)} required />
                  </div>
                  <div className="md:col-span-2">
                    <label className={labelCls}>Phone Number *</label>
                    <input className={inputCls} value={phone} onChange={e => setPhone(e.target.value)} required />
                  </div>
                </div>
              </section>
            )}

            <section className="bg-white rounded-2xl border border-[#C0C0C0]/40 p-6 md:p-8">
              <h2 className="text-lg font-semibold text-black mb-1">Service Request</h2>
              <p className="text-sm text-black/60 mb-4">Select all services you are interested in.</p>
              <div className="h-px bg-[#C0C0C0]/40 mb-5" />
              <div className="space-y-2">
                {SERVICE_NAMES.map(s => (
                  <label key={s} className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition ${services.includes(s) ? 'border-[#D4AF37] bg-[#D4AF37]/5' : 'border-[#C0C0C0]/40 hover:bg-[#FAF6EC]'}`}>
                    <input type="checkbox" checked={services.includes(s)} onChange={() => toggleService(s)} className="w-4 h-4 accent-[#D4AF37]" />
                    <span className="text-sm text-black">{s}</span>
                  </label>
                ))}
              </div>
              {needsInvestigationTitle && (
                <div className="mt-5">
                  <label className={labelCls}>Investigation Title *</label>
                  <input
                    className={inputCls}
                    value={investigationTitle}
                    onChange={e => setInvestigationTitle(e.target.value)}
                    placeholder='e.g. "Missing Funds", "Medication Error", "Allegation of Neglect"'
                    required
                  />
                </div>
              )}
            </section>

            <section className="bg-white rounded-2xl border border-[#C0C0C0]/40 p-6 md:p-8">
              <h2 className="text-lg font-semibold text-black mb-1">Project Details</h2>
              <div className="h-px bg-[#C0C0C0]/40 mb-5" />
              <div className="space-y-4">
                <div>
                  <label className={labelCls}>Brief Description</label>
                  <textarea className={inputCls} rows={4} value={description} onChange={e => setDescription(e.target.value)} />
                </div>
                <div>
                  <label className={labelCls}>Desired Start Timeline</label>
                  <select className={inputCls} value={timeline} onChange={e => setTimeline(e.target.value)}>
                    <option value="">Select...</option>
                    {TIMELINE_OPTIONS.map(t => <option key={t}>{t}</option>)}
                  </select>
                </div>
              </div>
            </section>

            <section className="bg-white rounded-2xl border border-[#C0C0C0]/40 p-6 md:p-8">
              <h2 className="text-lg font-semibold text-black mb-1">Availability</h2>
              <p className="text-sm text-black/60 mb-4">Add one or more dates and time ranges that work for you. Resolve360 will pick a slot from your options.</p>
              <div className="h-px bg-[#C0C0C0]/40 mb-5" />
              <div className="space-y-3">
                {availSlots.map((slot, idx) => (
                  <div key={idx} className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end p-3 rounded-lg border border-[#C0C0C0]/40 bg-[#FAF6EC]/40">
                    <div className="md:col-span-4">
                      <label className={labelCls}>Date {idx === 0 ? '' : `#${idx + 1}`}</label>
                      <input
                        type="date"
                        className={inputCls}
                        value={slot.date}
                        onChange={e => setAvailSlots(prev => prev.map((s, i) => i === idx ? { ...s, date: e.target.value } : s))}
                      />
                    </div>
                    <div className="md:col-span-3">
                      <label className={labelCls}>Start time</label>
                      <input
                        type="time"
                        className={inputCls}
                        value={slot.startTime}
                        onChange={e => setAvailSlots(prev => prev.map((s, i) => i === idx ? { ...s, startTime: e.target.value } : s))}
                      />
                    </div>
                    <div className="md:col-span-3">
                      <label className={labelCls}>End time</label>
                      <input
                        type="time"
                        className={inputCls}
                        value={slot.endTime}
                        onChange={e => setAvailSlots(prev => prev.map((s, i) => i === idx ? { ...s, endTime: e.target.value } : s))}
                      />
                    </div>
                    <div className="md:col-span-2 flex md:justify-end">
                      {availSlots.length > 1 && (
                        <button
                          type="button"
                          onClick={() => setAvailSlots(prev => prev.filter((_, i) => i !== idx))}
                          className="inline-flex items-center gap-1 px-3 py-2 rounded-lg border border-red-200 bg-white text-red-700 text-sm font-medium hover:bg-red-50"
                        >
                          <Trash2 className="w-4 h-4" /> Remove
                        </button>
                      )}
                    </div>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() => setAvailSlots(prev => [...prev, { date: '', startTime: '', endTime: '' }])}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-[#D4AF37]/60 bg-white text-black text-sm font-semibold hover:bg-[#FAF6EC]"
                >
                  <Plus className="w-4 h-4" /> Add Another Availability
                </button>
              </div>
            </section>

            {error && <div className="p-4 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">{error}</div>}

            <button
              type="submit"
              disabled={submitting}
              className="w-full inline-flex items-center justify-center gap-2 px-8 py-4 rounded-lg bg-[#D4AF37] text-black font-semibold hover:bg-[#B8961F] transition disabled:opacity-50"
            >
              {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
              Submit Request
            </button>
          </form>
        )}
      </div>
      <Footer />
    </div>
  );
};

export default GetStarted;
