import React, { useEffect, useState } from 'react';
import { Navigate, useParams, Link, useNavigate } from 'react-router-dom';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import StatusBadge from '@/components/StatusBadge';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { sendNotification } from '@/lib/notify';
import { ArrowLeft, FileText, Loader2, Upload, Download, Save, Mail, Trash2, Edit3, Send, Eye, History, PenSquare, CheckCircle2, KeyRound, Copy, Plus, ShieldOff } from 'lucide-react';
import { STATUS_FLOW } from '@/lib/services';
import { generateContractText, generateGenericContractText, computeContractStatus, downloadContractPdf } from '@/lib/contract';


const SIGNATURE_FONTS_LIST = [
  { id: 'dancing', label: 'Dancing Script', css: '"Dancing Script", "Brush Script MT", cursive' },
  { id: 'great-vibes', label: 'Great Vibes', css: '"Great Vibes", "Apple Chancery", cursive' },
  { id: 'pacifico', label: 'Pacifico', css: '"Pacifico", "Lucida Handwriting", cursive' },
  { id: 'caveat', label: 'Caveat', css: '"Caveat", "Segoe Script", cursive' },
  { id: 'satisfy', label: 'Satisfy', css: '"Satisfy", "Bradley Hand", cursive' },
];
const SIGNATURE_FONTS: Record<string, string> = SIGNATURE_FONTS_LIST.reduce((acc, f) => ({ ...acc, [f.id]: f.css }), {} as Record<string, string>);

const FONTS_LINK_ID = 'r360-signature-fonts';
const ensureFontsLoaded = () => {
  if (typeof document === 'undefined') return;
  if (document.getElementById(FONTS_LINK_ID)) return;
  const link = document.createElement('link');
  link.id = FONTS_LINK_ID;
  link.rel = 'stylesheet';
  link.href = 'https://fonts.googleapis.com/css2?family=Caveat&family=Dancing+Script&family=Great+Vibes&family=Pacifico&family=Satisfy&display=swap';
  document.head.appendChild(link);
};

// PDF download wrapper — calls the resolve360-contract-pdf edge function so the
// signed PDF is generated server-side for layout consistency.
const downloadContractPdfFor = async (contract: any, userName: string, fileNameLabel?: string) => {
  await downloadContractPdf({ contract, userName, fileNameLabel });
};

const downloadContactsCsv = (contacts: any[], reqRef: string) => {
  const header = ['Name', 'Role', 'Phone', 'Email', 'Notes'];
  const rows = contacts.map(c => [c.name, c.role || '', c.phone || '', c.email || '', (c.notes || '').replace(/\n/g, ' ')]);
  const csv = [header, ...rows].map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = `contacts-${reqRef}.csv`;
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

const formatBytes = (n?: number | null) => {
  if (!n) return '';
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
};

// Statuses for outreach to people-to-contact (mirror of client-side list).
const CONTACT_STATUSES = ['Pending', 'Contacted', 'Scheduled', 'Interviewed', 'Unable to Reach'] as const;

const AdminRequestDetail: React.FC = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, profile, loading } = useAuth();
  const [req, setReq] = useState<any>(null);

  const [company, setCompany] = useState<any>(null);
  const [activeContract, setActiveContract] = useState<any>(null);
  const [contractHistory, setContractHistory] = useState<any[]>([]);
  const [docs, setDocs] = useState<any[]>([]);
  const [contacts, setContacts] = useState<any[]>([]);
  const [reports, setReports] = useState<any[]>([]);
  const [statements, setStatements] = useState<any[]>([]);
  const [busy, setBusy] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingReport, setUploadingReport] = useState(false);

  // Editable request fields
  const [status, setStatus] = useState('');
  const [price, setPrice] = useState('');
  const [scopeNotes, setScopeNotes] = useState('');
  const [investigator, setInvestigator] = useState('');
  const [internalNotes, setInternalNotes] = useState('');
  const [clientNotes, setClientNotes] = useState('');

  // Contract editor
  const [editingContract, setEditingContract] = useState(false);
  const [contractDraft, setContractDraft] = useState('');

  // Admin signature
  const [adminSignature, setAdminSignature] = useState('');
  const [adminSignatureFont, setAdminSignatureFont] = useState(SIGNATURE_FONTS_LIST[0].id);
  const [adminSigning, setAdminSigning] = useState(false);

  // Final report form
  const [reportNotes, setReportNotes] = useState('');
  const [reportVisible, setReportVisible] = useState(true);

  // Statement link generator form (investigation-only)
  const [stmtFirst, setStmtFirst] = useState('');
  const [stmtLast, setStmtLast] = useState('');
  const [stmtEmail, setStmtEmail] = useState('');
  const [stmtLabel, setStmtLabel] = useState('');
  const [creatingStatement, setCreatingStatement] = useState(false);
  const [copiedToken, setCopiedToken] = useState<string | null>(null);

  // Per-contact admin notes draft (so typing doesn't fight DB writes).
  const [contactNotesDraft, setContactNotesDraft] = useState<Record<string, string>>({});

  const load = async () => {
    if (!id) return;
    const { data: r } = await supabase.from('service_requests').select('*').eq('id', id).maybeSingle();
    setReq(r);
    if (r) {
      setStatus(r.status);
      setPrice(r.price?.toString() || '');
      setScopeNotes(r.scope_notes || '');
      setInvestigator(r.assigned_investigator || '');
      setInternalNotes(r.admin_internal_notes || '');
      setClientNotes(r.client_visible_notes || '');
      const { data: c } = await supabase.from('companies').select('*').eq('id', r.company_id).maybeSingle();
      setCompany(c);
    }
    const { data: allCt } = await supabase.from('contracts').select('*').eq('request_id', id).order('version_number', { ascending: false });
    const list = allCt || [];
    const active = list.find((c: any) => c.is_active_version) || list[0] || null;
    setActiveContract(active);
    setContractHistory(list.filter((c: any) => c.id !== active?.id));
    if (active) setContractDraft(active.contract_text || '');

    const { data: d } = await supabase.from('investigation_documents').select('*').eq('request_id', id).order('created_at', { ascending: false });
    setDocs(d || []);
    const { data: ic } = await supabase.from('investigation_contacts').select('*').eq('request_id', id);
    setContacts(ic || []);
    const { data: fr } = await supabase.from('final_reports').select('*').eq('request_id', id).order('created_at', { ascending: false });
    setReports(fr || []);
    const { data: stmts } = await supabase.from('investigation_statements').select('*').eq('request_id', id).order('created_at', { ascending: false });
    setStatements(stmts || []);
    setBusy(false);
  };
  useEffect(() => { ensureFontsLoaded(); }, []);
  useEffect(() => { load(); }, [id]);


  // Sign the contract as Admin/Resolve360.
  const signContractAsAdmin = async () => {
    if (!adminSignature.trim() || !activeContract) return;
    setAdminSigning(true);
    const nowIso = new Date().toISOString();
    const adminName = profile?.first_name || profile?.email || 'Resolve360 Admin';
    // If the client already signed, this completes the contract. Otherwise it's just admin-signed.
    const fullyExecuted = !!activeContract.client_signature;
    const newStatus = fullyExecuted ? 'fully_executed' : 'admin_signed';
    await supabase.from('contracts').update({
      admin_signature: adminSignature,
      admin_signature_font: adminSignatureFont,
      admin_signed_at: nowIso,
      admin_signed_by: user.id,
      admin_signed_by_name: adminName,
      status: newStatus,
      updated_at: nowIso,
    }).eq('id', activeContract.id);
    if (fullyExecuted) {
      sendNotification('contract_fully_executed', req.id);
    } else {
      sendNotification('contract_admin_signed', req.id);
    }
    setAdminSigning(false);
    setAdminSignature('');
    await load();
  };
  if (loading) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="w-6 h-6 animate-spin text-[#D4AF37]" /></div>;
  if (!user) return <Navigate to="/login" />;
  if (profile?.role !== 'admin') return <Navigate to="/portal" />;
  if (busy || !req) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="w-6 h-6 animate-spin text-[#D4AF37]" /></div>;

  const isInvestigation = req.selected_services?.includes('Certified Investigation ODP');

  const saveAll = async () => {
    setSaving(true);
    const prevStatus = req.status;
    await supabase.from('service_requests').update({
      status,
      price: price ? parseFloat(price) : null,
      scope_notes: scopeNotes,
      assigned_investigator: investigator,
      admin_internal_notes: internalNotes,
      client_visible_notes: clientNotes,
      updated_at: new Date().toISOString(),
    }).eq('id', req.id);

    if (status !== prevStatus) {
      // Always alert the user when admin changes status
      sendNotification('status_changed', req.id, { newStatus: status });
      if (status === 'Investigator Assigned') sendNotification('investigator_assigned', req.id);
      if (status === 'Investigation Complete') sendNotification('investigation_complete', req.id);
    }
    setSaving(false);
    await load();
  };

  // Generate (or regenerate) the contract for this request.
  // - Investigation requests use the dedicated investigation template.
  // - Every other service uses the generic Resolve360 service-agreement template.
  // Both flows share the same contracts table, version_number, and signature flow,
  // so all contract management UI/logic remains identical for every service type.
  const generateContract = async () => {
    if (!company) return;
    let text: string;
    if (isInvestigation && req.investigation_title) {
      if (!price) return;
      text = generateContractText({
        companyName: company.company_name,
        date: new Date().toLocaleDateString(),
        investigationTitle: req.investigation_title,
        price,
        primaryContactName: `${company.primary_contact_first_name} ${company.primary_contact_last_name}`,
        consultantName: 'Sharnese Jones',
      });
    } else {
      // Generic agreement covers all other services.
      text = generateGenericContractText({
        companyName: company.company_name,
        date: new Date().toLocaleDateString(),
        serviceTitle: req.investigation_title || (req.selected_services?.[0] || 'Resolve360 Services'),
        serviceList: req.selected_services || [],
        price: price || '',
        primaryContactName: `${company.primary_contact_first_name} ${company.primary_contact_last_name}`,
        consultantName: 'Sharnese Jones',
      });
    }
    if (activeContract) {
      // Replace text on active version
      await supabase.from('contracts').update({
        contract_text: text, price: price ? parseFloat(price) : activeContract.price, updated_at: new Date().toISOString(),
      }).eq('id', activeContract.id);
    } else {
      await supabase.from('contracts').insert({
        request_id: req.id,
        contract_text: text,
        price: price ? parseFloat(price) : null,
        status: 'sent',
        version_number: 1,
        is_active_version: true,
      });
    }
    await supabase.from('service_requests').update({
      status: 'Proposal Sent',
      price: price ? parseFloat(price) : req.price,
      updated_at: new Date().toISOString(),
    }).eq('id', req.id);
    sendNotification('proposal_sent', req.id);
    sendNotification('contract_ready', req.id);
    sendNotification('status_changed', req.id, { newStatus: 'Proposal Sent' });
    await load();
  };


  // Edit and resubmit: deactivates current version and creates a new active version
  const resubmitContract = async () => {
    if (!contractDraft.trim() || !activeContract) return;
    // Deactivate current version
    await supabase.from('contracts').update({ is_active_version: false }).eq('id', activeContract.id);
    // Create new version
    const newVersion = (activeContract.version_number || 1) + 1;
    await supabase.from('contracts').insert({
      request_id: req.id,
      contract_text: contractDraft,
      price: price ? parseFloat(price) : activeContract.price,
      status: 'resubmitted',
      version_number: newVersion,
      is_active_version: true,
    });
    await supabase.from('service_requests').update({
      status: 'Proposal Sent', updated_at: new Date().toISOString(),
    }).eq('id', req.id);
    sendNotification('contract_resubmitted', req.id);
    sendNotification('status_changed', req.id, { newStatus: 'Proposal Sent' });
    setEditingContract(false);
    await load();
  };

  const requestDocuments = async () => {
    sendNotification('documents_requested', req.id);
    alert('Document request notification sent to the client.');
  };

  const uploadFinalReport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setUploadingReport(true);
    const safeName = f.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    const path = `${req.id}/final-${Date.now()}-${safeName}`;
    const { error } = await supabase.storage.from('final-reports').upload(path, f, {
      contentType: f.type || 'application/octet-stream',
    });
    if (!error) {
      const { data: urlData } = supabase.storage.from('final-reports').getPublicUrl(path);
      await supabase.from('final_reports').insert({
        request_id: req.id,
        file_name: f.name,
        file_url: urlData.publicUrl,
        uploaded_by_admin: user.id,
        report_notes: reportNotes || null,
        visible_to_client: reportVisible,
        file_type: f.type || null,
        file_size: f.size || null,
      });
      if (reportVisible) sendNotification('investigation_complete', req.id);
      setReportNotes('');
    } else {
      console.error('Final report upload failed:', error);
      alert('Final report upload failed: ' + error.message);
    }
    setUploadingReport(false);
    e.target.value = '';
    await load();
  };

  const toggleReportVisibility = async (r: any) => {
    const newVal = !r.visible_to_client;
    await supabase.from('final_reports').update({ visible_to_client: newVal }).eq('id', r.id);
    if (newVal) sendNotification('investigation_complete', req.id);
    await load();
  };

  const deleteRequest = async () => {
    if (!confirm('Permanently delete this request, its contract, documents, contacts, and final reports? This cannot be undone.')) return;
    await supabase.from('contracts').delete().eq('request_id', req.id);
    await supabase.from('investigation_documents').delete().eq('request_id', req.id);
    await supabase.from('investigation_contacts').delete().eq('request_id', req.id);
    await supabase.from('final_reports').delete().eq('request_id', req.id);
    await supabase.from('service_requests').delete().eq('id', req.id);
    navigate('/admin');
  };

  // ---- Investigation Statement Link helpers ----

  // Generates a unique link + short password for an interviewee/witness.
  // Statements live in the investigation_statements table. The token is the
  // public URL identifier; the password is a short code shared separately.
  const randomToken = (len = 18) => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
    let out = '';
    for (let i = 0; i < len; i++) out += chars[Math.floor(Math.random() * chars.length)];
    return out;
  };

  const createStatementLink = async () => {
    if (!req?.id) return;
    setCreatingStatement(true);
    const token = randomToken(20);
    const code = randomToken(6).toUpperCase();
    await supabase.from('investigation_statements').insert({
      request_id: req.id,
      link_token: token,
      password_code: code,
      first_name: stmtFirst || null,
      last_name: stmtLast || null,
      email: stmtEmail || null,
      internal_label: stmtLabel || null,
      status: 'pending',
      created_by: user.id,
    });
    setStmtFirst(''); setStmtLast(''); setStmtEmail(''); setStmtLabel('');
    setCreatingStatement(false);
    await load();
  };

  const disableStatement = async (sid: string) => {
    if (!confirm('Disable this statement link? The interviewee will no longer be able to submit using it.')) return;
    await supabase.from('investigation_statements').update({
      status: 'expired',
      disabled_at: new Date().toISOString(),
    }).eq('id', sid);
    await load();
  };

  const buildStatementUrl = (token: string) =>
    `${window.location.origin}/statement/${token}`;

  const copyStatementInfo = async (s: any) => {
    const url = buildStatementUrl(s.link_token);
    const text = `Resolve360 Written Statement\nLink: ${url}\nAccess code: ${s.password_code}`;
    try {
      await navigator.clipboard.writeText(text);
      setCopiedToken(s.link_token);
      setTimeout(() => setCopiedToken(null), 2000);
    } catch {
      prompt('Copy the link and code:', text);
    }
  };

  // Witness statements ALWAYS download as PDF (never .doc/.docx/.txt). The
  // PDF is generated server-side by the resolve360-statement-pdf edge function
  // so the file is locked, formatted consistently, and includes the signature
  // block. The filename always ends in `.pdf`.
  const downloadStatementPdf = async (s: any) => {
    try {
      const fontLabel = SIGNATURE_FONTS_LIST.find(f => f.id === s.signature_font)?.label || s.signature_font || '';
      const { data, error } = await supabase.functions.invoke('resolve360-statement-pdf', {
        body: {
          statement: s,
          requestRef: req?.request_id || '',
          requestTitle: req?.investigation_title || '',
          adminRef: profile?.first_name ? `Admin: ${profile.first_name}` : '',
          signatureFontLabel: fontLabel,
        },
      });
      if (error) throw error;

      // supabase-js returns a Blob when the response Content-Type isn't JSON.
      // Coerce other shapes (ArrayBuffer / binary string) into a PDF Blob.
      let blob: Blob;
      if (data instanceof Blob) blob = data;
      else if (data instanceof ArrayBuffer) blob = new Blob([data], { type: 'application/pdf' });
      else if (typeof data === 'string') {
        const bytes = new Uint8Array(data.length);
        for (let i = 0; i < data.length; i++) bytes[i] = data.charCodeAt(i) & 0xff;
        blob = new Blob([bytes], { type: 'application/pdf' });
      } else {
        throw new Error('Unexpected PDF response type');
      }

      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const name = [s.first_name, s.last_name].filter(Boolean).join('_') || 'Statement';
      a.download = `Statement_${name}_${(s.id || '').slice(0, 8)}.pdf`;
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err: any) {
      console.error('Statement PDF download failed:', err);
      alert('Could not generate the statement PDF. Please try again.');
    }
  };
  // ---- Admin contact-status helpers ----
  // Updates the outreach status / admin notes / linked statement on a contact.
  // Always stamps last_status_update so the client sees a clear timeline,
  // and notifies the client whenever the status changes.
  const updateContactStatus = async (cid: string, newStatus: string) => {
    const target = contacts.find(c => c.id === cid);
    const prevStatus = target?.contact_status || 'Pending';
    if (prevStatus === newStatus) return;
    const nowIso = new Date().toISOString();
    await supabase.from('investigation_contacts').update({
      contact_status: newStatus,
      last_status_update: nowIso,
      updated_at: nowIso,
    }).eq('id', cid);
    sendNotification('contact_status_changed', req.id, {
      contactId: cid,
      contactName: target?.name,
      newStatus,
      prevStatus,
    });
    await load();
  };

  const saveContactAdminNotes = async (cid: string) => {
    const draft = contactNotesDraft[cid] ?? '';
    const nowIso = new Date().toISOString();
    await supabase.from('investigation_contacts').update({
      admin_notes: draft,
      updated_at: nowIso,
    }).eq('id', cid);
    await load();
  };

  const linkStatementToContact = async (cid: string, statementId: string | null) => {
    const target = contacts.find(c => c.id === cid);
    const nowIso = new Date().toISOString();
    await supabase.from('investigation_contacts').update({
      linked_statement_id: statementId || null,
      updated_at: nowIso,
    }).eq('id', cid);
    if (statementId) {
      // A linked completed statement = witness statement is now available for
      // this person — notify the client so they can download the PDF.
      sendNotification('witness_statement_completed', req.id, {
        contactId: cid,
        contactName: target?.name,
        statementId,
      });
    }
    await load();
  };

  const inputCls = "w-full px-3 py-2 rounded-lg border border-[#C0C0C0]/60 bg-white text-sm focus:outline-none focus:border-[#D4AF37]";

  const contractStatusLabel = computeContractStatus(activeContract);
  const fullyExecuted = !!(activeContract?.admin_signature && activeContract?.client_signature);
  const availabilityOptions: any[] = Array.isArray(req.availability_options) ? req.availability_options : [];


  return (
    <div className="min-h-screen bg-[#FAF6EC]">
      <Header />
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <Link to="/admin" className="inline-flex items-center gap-1 text-sm text-black/60 hover:text-black mb-4">
          <ArrowLeft className="w-4 h-4" /> Back to dashboard
        </Link>

        <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
          <div>
            <div className="text-xs text-black/50 mb-1">{req.request_id}</div>
            <h1 className="text-3xl font-bold text-black">{req.investigation_title || req.selected_services?.[0]}</h1>
            <p className="text-sm text-black/60 mt-1">{company?.company_name}</p>
          </div>
          <StatusBadge status={req.status} />
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            {/* Submission details */}
            <section className="bg-white rounded-2xl border border-[#C0C0C0]/40 p-6">
              <h2 className="text-lg font-semibold text-black mb-4">Submission Details</h2>
              <div className="grid sm:grid-cols-2 gap-4 text-sm">
                <div><dt className="text-black/50 text-xs uppercase">Services</dt><dd className="text-black">{(req.selected_services || []).join(', ')}</dd></div>
                <div><dt className="text-black/50 text-xs uppercase">Timeline</dt><dd className="text-black">{req.desired_start_timeline || '—'}</dd></div>
                <div><dt className="text-black/50 text-xs uppercase">Submitted</dt><dd className="text-black">{new Date(req.created_at).toLocaleDateString()}</dd></div>
                {req.price && <div><dt className="text-black/50 text-xs uppercase">Price</dt><dd className="text-black font-semibold">${req.price}</dd></div>}
                <div className="sm:col-span-2">
                  <dt className="text-black/50 text-xs uppercase mb-1">Client Availability Options</dt>
                  {availabilityOptions.length > 0 ? (
                    <ul className="space-y-1.5">
                      {availabilityOptions.map((slot: any, i: number) => (
                        <li key={i} className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#FAF6EC] border border-[#C0C0C0]/40 text-sm text-black mr-2 mb-1">
                          <span className="font-medium">
                            {slot.date ? new Date(slot.date + 'T00:00').toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' }) : 'Date —'}
                          </span>
                          <span className="text-black/60 text-xs">
                            {slot.startTime || '—'}{slot.endTime ? ` – ${slot.endTime}` : ''}
                          </span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <dd className="text-black">{req.availability_datetime ? new Date(req.availability_datetime).toLocaleString() : '—'}</dd>
                  )}
                </div>
                <div className="sm:col-span-2"><dt className="text-black/50 text-xs uppercase">Description</dt><dd className="text-black whitespace-pre-wrap">{req.description || '—'}</dd></div>
              </div>
              {company && (
                <div className="mt-4 p-4 rounded-lg bg-[#FAF6EC] border border-[#C0C0C0]/40 text-sm">
                  <p className="font-semibold text-black mb-1">{company.company_name}</p>
                  <p className="text-black/70">{company.primary_contact_first_name} {company.primary_contact_last_name} · {company.email} · {company.phone}</p>
                  <p className="text-black/60 text-xs">{company.address}</p>
                </div>
              )}
            </section>


            {/* Management controls */}
            <section className="bg-white rounded-2xl border border-[#C0C0C0]/40 p-6">
              <h2 className="text-lg font-semibold text-black mb-4">Management</h2>
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs uppercase text-black/60 mb-1 block">Status</label>
                  <select value={status} onChange={e => setStatus(e.target.value)} className={inputCls}>
                    {STATUS_FLOW.map(s => <option key={s}>{s}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs uppercase text-black/60 mb-1 block">Price ($)</label>
                  <input type="number" value={price} onChange={e => setPrice(e.target.value)} className={inputCls} />
                </div>
                <div className="sm:col-span-2">
                  <label className="text-xs uppercase text-black/60 mb-1 block">Scope Notes</label>
                  <textarea value={scopeNotes} onChange={e => setScopeNotes(e.target.value)} className={inputCls} rows={2} />
                </div>
                <div>
                  <label className="text-xs uppercase text-black/60 mb-1 block">Assigned Investigator</label>
                  <input value={investigator} onChange={e => setInvestigator(e.target.value)} className={inputCls} />
                </div>
                <div className="sm:col-span-2">
                  <label className="text-xs uppercase text-black/60 mb-1 block">Internal Notes (admin only)</label>
                  <textarea value={internalNotes} onChange={e => setInternalNotes(e.target.value)} className={inputCls} rows={3} />
                </div>
                <div className="sm:col-span-2">
                  <label className="text-xs uppercase text-black/60 mb-1 block">Client-Visible Notes</label>
                  <textarea value={clientNotes} onChange={e => setClientNotes(e.target.value)} className={inputCls} rows={3} />
                </div>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                <button onClick={saveAll} disabled={saving} className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-[#D4AF37] text-black font-semibold hover:bg-[#B8961F] disabled:opacity-50">
                  <Save className="w-4 h-4" /> {saving ? 'Saving...' : 'Save Changes'}
                </button>
                <button
                  onClick={generateContract}
                  disabled={isInvestigation ? (!price || !req.investigation_title) : !company}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-black text-[#D4AF37] font-semibold hover:bg-[#1a1410] disabled:opacity-50"
                  title={isInvestigation ? 'Generate the investigation contract' : 'Generate a service agreement for this request'}
                >
                  <FileText className="w-4 h-4" /> {activeContract ? 'Regenerate Contract' : 'Generate Contract'}
                </button>
                {isInvestigation && (
                  <button onClick={requestDocuments} className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg border border-[#C9A961]/60 bg-white text-black font-semibold hover:bg-[#FAF6EC]">
                    <Mail className="w-4 h-4" /> Request Documents
                  </button>
                )}

                <button onClick={deleteRequest} className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg border border-red-300 bg-white text-red-700 font-semibold hover:bg-red-50 ml-auto">
                  <Trash2 className="w-4 h-4" /> Delete Request
                </button>
              </div>
            </section>

            {/* Contract */}
            {activeContract && (
              <section className="bg-white rounded-2xl border border-[#C0C0C0]/40 p-6">
                <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
                  <h2 className="text-lg font-semibold text-black flex items-center gap-2">
                    Contract
                    <span className="text-xs font-normal text-black/50">v{activeContract.version_number || 1}</span>
                  </h2>
                  <span className="text-xs px-2.5 py-1 rounded-full border bg-[#FAF6EC] border-[#C0C0C0]/60 text-black/70">
                    {contractStatusLabel}
                  </span>
                </div>

                {activeContract.change_request_notes && activeContract.status === 'change_requested' && (
                  <div className="mb-4 p-4 rounded-lg bg-orange-50 border border-orange-200">
                    <p className="text-xs uppercase tracking-wide font-semibold text-orange-800 mb-1">Client requested changes</p>
                    <p className="text-sm text-black whitespace-pre-wrap">{activeContract.change_request_notes}</p>
                    {activeContract.change_requested_at && <p className="text-xs text-black/50 mt-2">Submitted {new Date(activeContract.change_requested_at).toLocaleString()}</p>}
                    <p className="text-xs text-black/60 mt-2">Edit the contract below and click Resubmit to send the revised version.</p>
                  </div>
                )}

                {editingContract ? (
                  <textarea
                    value={contractDraft}
                    onChange={e => setContractDraft(e.target.value)}
                    rows={18}
                    className="w-full px-4 py-3 rounded-lg border border-[#D4AF37]/60 bg-white text-sm font-sans focus:outline-none focus:border-[#D4AF37]"
                  />
                ) : (
                  <pre className="whitespace-pre-wrap text-sm text-black/80 bg-[#FAF6EC] border border-[#C0C0C0]/40 rounded-lg p-4 max-h-72 overflow-auto font-sans">{activeContract.contract_text}</pre>
                )}

                <div className="mt-3 flex flex-wrap gap-2">
                  {!editingContract ? (
                    <>
                      <button
                        onClick={() => { setEditingContract(true); setContractDraft(activeContract.contract_text || ''); }}
                        className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-[#C0C0C0]/60 bg-white text-black text-sm font-medium hover:border-[#D4AF37]"
                      >
                        <Edit3 className="w-4 h-4" /> Edit Contract
                      </button>
                      <button
                        onClick={() => downloadContractPdfFor(activeContract, company?.company_name || 'Client')}
                        className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-[#C0C0C0]/60 bg-white text-black text-sm font-medium hover:border-[#D4AF37]"
                      >
                        <Download className="w-4 h-4" /> Download PDF
                      </button>
                      {fullyExecuted && (
                        <button
                          onClick={() => downloadContractPdfFor(activeContract, company?.company_name || 'Client', 'Fully_Executed')}
                          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#D4AF37] text-black text-sm font-semibold hover:bg-[#B8961F]"
                        >
                          <Download className="w-4 h-4" /> Download Fully Executed PDF
                        </button>
                      )}
                      {!fullyExecuted && activeContract.client_signature && (
                        <button
                          onClick={() => downloadContractPdfFor(activeContract, company?.company_name || 'Client', `User_Signed_v${activeContract.version_number || 1}`)}
                          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#D4AF37] text-black text-sm font-semibold hover:bg-[#B8961F]"
                        >
                          <Download className="w-4 h-4" /> Download Signed PDF
                        </button>
                      )}
                    </>
                  ) : (
                    <>
                      <button
                        onClick={resubmitContract}
                        disabled={!contractDraft.trim()}
                        className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#D4AF37] text-black text-sm font-semibold hover:bg-[#B8961F] disabled:opacity-50"
                      >
                        <Send className="w-4 h-4" /> Save & Resubmit Contract
                      </button>
                      <button
                        onClick={() => { setEditingContract(false); setContractDraft(activeContract.contract_text || ''); }}
                        className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-[#C0C0C0]/60 bg-white text-black text-sm font-medium hover:bg-[#FAF6EC]"
                      >
                        Cancel
                      </button>
                    </>
                  )}
                </div>

                {/* Dual signature panel */}
                <div className="mt-4 grid sm:grid-cols-2 gap-3 text-sm">
                  {/* Admin signature block */}
                  <div className={`p-3 rounded-lg border ${activeContract.admin_signature ? 'bg-[#D4AF37]/10 border-[#D4AF37]/40' : 'bg-[#FAF6EC] border-[#C0C0C0]/40'}`}>
                    <p className="text-xs uppercase tracking-wide text-[#7a6010] font-semibold mb-1">Resolve360 Signature (Admin)</p>
                    {activeContract.admin_signature ? (
                      <>
                        <p className="text-2xl text-black" style={{ fontFamily: SIGNATURE_FONTS[activeContract.admin_signature_font] || 'cursive' }}>
                          {activeContract.admin_signature}
                        </p>
                        <p className="text-xs text-black/60 mt-1">
                          {activeContract.admin_signed_by_name ? `${activeContract.admin_signed_by_name} · ` : ''}
                          Signed {new Date(activeContract.admin_signed_at).toLocaleString()}
                        </p>
                      </>
                    ) : (
                      <p className="text-black/60 text-xs">Not yet signed by Resolve360.</p>
                    )}
                  </div>
                  {/* Client signature block */}
                  <div className={`p-3 rounded-lg border ${activeContract.client_signature ? 'bg-[#D4AF37]/10 border-[#D4AF37]/40' : 'bg-[#FAF6EC] border-[#C0C0C0]/40'}`}>
                    <p className="text-xs uppercase tracking-wide text-[#7a6010] font-semibold mb-1">Client Signature</p>
                    {activeContract.client_signature ? (
                      <>
                        <p className="text-2xl text-black" style={{ fontFamily: SIGNATURE_FONTS[activeContract.signature_font] || 'cursive' }}>
                          {activeContract.client_signature}
                        </p>
                        <p className="text-xs text-black/60 mt-1">Signed {new Date(activeContract.signed_at).toLocaleString()}</p>
                      </>
                    ) : (
                      <p className="text-black/60 text-xs">Awaiting client signature.</p>
                    )}
                  </div>
                </div>

                {fullyExecuted && (
                  <div className="mt-3 p-3 rounded-lg bg-green-50 border border-green-200 inline-flex items-center gap-2 text-sm text-green-800">
                    <CheckCircle2 className="w-4 h-4" /> Contract is fully executed.
                  </div>
                )}

                {/* Admin signing UI - only when admin has not yet signed */}
                {!activeContract.admin_signature && !editingContract && (
                  <div className="mt-5 p-4 rounded-lg border border-[#D4AF37]/40 bg-[#FAF6EC]">
                    <p className="text-sm font-semibold text-black mb-2 inline-flex items-center gap-2">
                      <PenSquare className="w-4 h-4 text-[#D4AF37]" /> Sign Contract as Resolve360
                    </p>
                    <input
                      className="w-full px-4 py-2 rounded-lg border border-[#C0C0C0]/60 bg-white focus:border-[#D4AF37] focus:outline-none text-sm mb-3"
                      value={adminSignature}
                      onChange={e => setAdminSignature(e.target.value)}
                      placeholder="Type your full name to sign as Resolve360"
                    />
                    <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2 mb-3">
                      {SIGNATURE_FONTS_LIST.map(f => (
                        <button
                          type="button"
                          key={f.id}
                          onClick={() => setAdminSignatureFont(f.id)}
                          className={`p-2 rounded-lg border text-left transition ${adminSignatureFont === f.id ? 'border-[#D4AF37] ring-2 ring-[#D4AF37]/30 bg-white' : 'border-[#C0C0C0]/60 bg-white hover:border-[#D4AF37]'}`}
                        >
                          <div className="text-xl text-black truncate" style={{ fontFamily: f.css }}>
                            {adminSignature || 'Resolve360'}
                          </div>
                          <div className="text-[10px] text-black/50 mt-0.5">{f.label}</div>
                        </button>
                      ))}
                    </div>
                    <button
                      onClick={signContractAsAdmin}
                      disabled={adminSigning || !adminSignature.trim()}
                      className="inline-flex items-center gap-2 px-5 py-2 rounded-lg bg-[#D4AF37] text-black text-sm font-semibold hover:bg-[#B8961F] disabled:opacity-50"
                    >
                      <PenSquare className="w-4 h-4" /> {adminSigning ? 'Signing...' : (activeContract.client_signature ? 'Counter-sign & Fully Execute' : 'Sign as Resolve360')}
                    </button>
                  </div>
                )}

                {/* Contract version history */}
                {contractHistory.length > 0 && (
                  <div className="mt-6 border-t border-[#C0C0C0]/40 pt-4">
                    <p className="text-xs uppercase text-black/50 font-semibold mb-2 inline-flex items-center gap-1">
                      <History className="w-3 h-3" /> Previous Versions
                    </p>
                    <ul className="space-y-2">
                      {contractHistory.map(c => (
                        <li key={c.id} className="flex items-center justify-between p-2 rounded-lg border border-[#C0C0C0]/30 bg-[#FAF6EC] text-sm">
                          <div>
                            <span className="text-black font-medium">v{c.version_number}</span>
                            <span className="text-black/50 text-xs ml-2">{new Date(c.created_at).toLocaleDateString()} · {c.status}</span>
                          </div>
                          <button
                            onClick={() => downloadContractPdfFor(c, company?.company_name || 'Client', `v${c.version_number}`)}
                            className="text-[#A8871F] hover:text-[#D4AF37] inline-flex items-center gap-1 text-xs"
                          >
                            <Download className="w-3 h-3" /> Download PDF
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </section>
            )}

            {/* Documents */}
            {isInvestigation && (
              <section className="bg-white rounded-2xl border border-[#C0C0C0]/40 p-6">
                <h2 className="text-lg font-semibold text-black mb-4">Client Documents</h2>
                {docs.length === 0 ? <p className="text-sm text-black/60">No documents uploaded.</p> : (
                  <ul className="space-y-2">
                    {docs.map(d => (
                      <li key={d.id} className="flex items-start justify-between gap-3 p-3 rounded-lg border border-[#C0C0C0]/40 bg-[#FAF6EC]">
                        <div className="text-sm min-w-0 flex-1">
                          <p className="text-black font-medium truncate">{d.document_title || d.file_name}</p>
                          {d.document_title && d.document_title !== d.file_name && (
                            <p className="text-xs text-black/50 truncate">{d.file_name}</p>
                          )}
                          {d.notes && <p className="text-xs text-black/60 mt-0.5">{d.notes}</p>}
                          <p className="text-[11px] text-black/40 mt-1">
                            {(d.uploaded_by_role || 'client')} · {new Date(d.created_at).toLocaleString()}
                            {d.file_size ? ` · ${formatBytes(d.file_size)}` : ''}
                          </p>
                        </div>
                        <div className="flex items-center gap-3 flex-shrink-0">
                          <a href={d.file_url} target="_blank" rel="noopener noreferrer" className="text-sm text-black/60 hover:text-[#D4AF37] inline-flex items-center gap-1">
                            <Eye className="w-4 h-4" /> View
                          </a>
                          <a href={d.file_url} download={d.file_name} className="text-sm text-[#A8871F] hover:text-[#D4AF37] inline-flex items-center gap-1">
                            <Download className="w-4 h-4" /> Download
                          </a>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            )}

            {/* Final reports */}
            {isInvestigation && (
              <section className="bg-white rounded-2xl border border-[#C0C0C0]/40 p-6">
                <h2 className="text-lg font-semibold text-black mb-4">Final Investigation Document</h2>
                <div className="space-y-3 mb-4">
                  <textarea
                    value={reportNotes}
                    onChange={e => setReportNotes(e.target.value)}
                    placeholder="Final document notes (optional)"
                    className={inputCls}
                    rows={2}
                  />
                  <label className="inline-flex items-center gap-2 text-sm text-black">
                    <input type="checkbox" checked={reportVisible} onChange={e => setReportVisible(e.target.checked)} className="w-4 h-4 accent-[#D4AF37]" />
                    Visible to Client
                  </label>
                </div>
                <label className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-black text-[#D4AF37] font-semibold cursor-pointer hover:bg-[#1a1410] transition mb-4">
                  <Upload className="w-4 h-4" /> {uploadingReport ? 'Uploading...' : 'Submit Final Document'}
                  <input type="file" className="hidden" onChange={uploadFinalReport} disabled={uploadingReport} />
                </label>
                {reports.length > 0 && (
                  <ul className="space-y-2">
                    {reports.map(r => (
                      <li key={r.id} className="p-3 rounded-lg border border-[#C0C0C0]/40 bg-[#FAF6EC]">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-start gap-2 text-sm min-w-0 flex-1">
                            <FileText className="w-4 h-4 text-[#D4AF37] mt-0.5 flex-shrink-0" />
                            <div className="min-w-0 flex-1">
                              <p className="text-black font-medium truncate">{r.file_name}</p>
                              <p className="text-[11px] text-black/40">Uploaded {new Date(r.created_at).toLocaleString()} {r.file_size ? `· ${formatBytes(r.file_size)}` : ''}</p>
                              <button
                                onClick={() => toggleReportVisibility(r)}
                                className={`mt-1 text-xs px-2 py-0.5 rounded-full border ${r.visible_to_client ? 'border-green-300 bg-green-50 text-green-700' : 'border-[#C0C0C0]/60 bg-white text-black/60'}`}
                              >
                                {r.visible_to_client ? 'Visible to client' : 'Hidden from client'}
                              </button>
                            </div>
                          </div>
                          <div className="flex items-center gap-3 flex-shrink-0">
                            <a href={r.file_url} target="_blank" rel="noopener noreferrer" className="text-sm text-black/60 hover:text-[#D4AF37] inline-flex items-center gap-1">
                              <Eye className="w-4 h-4" />
                            </a>
                            <a href={r.file_url} download={r.file_name} className="text-sm text-[#A8871F] hover:text-[#D4AF37] inline-flex items-center gap-1">
                              <Download className="w-4 h-4" /> Download
                            </a>
                          </div>
                        </div>
                        {r.report_notes && <p className="text-xs text-black/60 mt-2 whitespace-pre-wrap">{r.report_notes}</p>}
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            )}

            {/* Investigation Written Statements (investigation only) */}
            {isInvestigation && (
              <section className="bg-white rounded-2xl border border-[#C0C0C0]/40 p-6">
                <div className="flex items-center justify-between gap-2 mb-1">
                  <h2 className="text-lg font-semibold text-black flex items-center gap-2">
                    <KeyRound className="w-5 h-5 text-[#D4AF37]" /> Written Statements
                  </h2>
                  <span className="text-xs text-black/50">{statements.length} link{statements.length === 1 ? '' : 's'}</span>
                </div>
                <p className="text-sm text-black/60 mb-4">
                  Generate a secure single-use link + access code for each interviewee, witness, or person involved.
                  Each link expires after the statement is submitted.
                </p>

                {/* Generator form */}
                <div className="p-4 rounded-lg border border-[#D4AF37]/40 bg-[#FAF6EC] mb-4">
                  <p className="text-sm font-semibold text-black mb-3 inline-flex items-center gap-2">
                    <Plus className="w-4 h-4 text-[#D4AF37]" /> Generate Statement Link
                  </p>
                  <div className="grid sm:grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs text-black/60 mb-1 block">First Name (optional)</label>
                      <input value={stmtFirst} onChange={e => setStmtFirst(e.target.value)} className={inputCls} placeholder="Jane" />
                    </div>
                    <div>
                      <label className="text-xs text-black/60 mb-1 block">Last Name (optional)</label>
                      <input value={stmtLast} onChange={e => setStmtLast(e.target.value)} className={inputCls} placeholder="Doe" />
                    </div>
                    <div>
                      <label className="text-xs text-black/60 mb-1 block">Email (optional)</label>
                      <input type="email" value={stmtEmail} onChange={e => setStmtEmail(e.target.value)} className={inputCls} placeholder="jane@example.com" />
                    </div>
                    <div>
                      <label className="text-xs text-black/60 mb-1 block">Internal Label / Notes</label>
                      <input value={stmtLabel} onChange={e => setStmtLabel(e.target.value)} className={inputCls} placeholder='e.g. "Witness #2 — receptionist"' />
                    </div>
                  </div>
                  <button
                    onClick={createStatementLink}
                    disabled={creatingStatement}
                    className="mt-3 inline-flex items-center gap-2 px-5 py-2 rounded-lg bg-[#D4AF37] text-black text-sm font-semibold hover:bg-[#B8961F] disabled:opacity-50"
                  >
                    {creatingStatement ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                    {creatingStatement ? 'Generating...' : 'Generate Secure Link'}
                  </button>
                </div>

                {/* Statement list */}
                {statements.length === 0 ? (
                  <p className="text-sm text-black/60">No statement links have been generated for this investigation yet.</p>
                ) : (
                  <ul className="space-y-3">
                    {statements.map(s => {
                      const interviewee = [s.first_name, s.last_name].filter(Boolean).join(' ') || s.internal_label || 'Interviewee';
                      const statusBadge = s.status === 'submitted'
                        ? 'bg-green-50 text-green-800 border-green-200'
                        : s.status === 'expired'
                        ? 'bg-gray-100 text-gray-600 border-gray-300'
                        : 'bg-[#FAF6EC] text-[#7a6010] border-[#D4AF37]/40';
                      const isCopied = copiedToken === s.link_token;
                      return (
                        <li key={s.id} className="p-4 rounded-lg border border-[#C0C0C0]/40 bg-white">
                          <div className="flex flex-wrap items-start justify-between gap-3 mb-2">
                            <div className="min-w-0">
                              <p className="text-black font-semibold">{interviewee}</p>
                              <p className="text-xs text-black/50 mt-0.5">
                                ID: {s.id.slice(0, 8)} · Created {new Date(s.created_at).toLocaleString()}
                                {s.submitted_at && ` · Submitted ${new Date(s.submitted_at).toLocaleString()}`}
                              </p>
                              {s.email && <p className="text-xs text-black/60 mt-0.5">{s.email}</p>}
                              {s.internal_label && (s.first_name || s.last_name) && (
                                <p className="text-xs text-black/50 italic mt-0.5">{s.internal_label}</p>
                              )}
                            </div>
                            <span className={`text-xs px-2.5 py-1 rounded-full border font-medium uppercase tracking-wide ${statusBadge}`}>
                              {s.status}
                            </span>
                          </div>

                          {s.status === 'pending' && (
                            <div className="grid sm:grid-cols-2 gap-2 text-xs mb-3">
                              <div className="p-2 rounded-lg bg-[#FAF6EC] border border-[#C0C0C0]/40">
                                <p className="text-[10px] uppercase text-black/50 mb-0.5">Statement link</p>
                                <p className="font-mono text-black break-all">{buildStatementUrl(s.link_token)}</p>
                              </div>
                              <div className="p-2 rounded-lg bg-[#FAF6EC] border border-[#C0C0C0]/40">
                                <p className="text-[10px] uppercase text-black/50 mb-0.5">Access code</p>
                                <p className="font-mono text-black tracking-widest text-base">{s.password_code}</p>
                              </div>
                            </div>
                          )}

                          {s.status === 'submitted' && s.statement_text && (
                            <details className="mb-3">
                              <summary className="cursor-pointer text-sm text-[#A8871F] hover:text-[#D4AF37] inline-flex items-center gap-1">
                                <Eye className="w-4 h-4" /> View statement
                              </summary>
                              <div className="mt-2 p-3 rounded-lg bg-[#FAF6EC] border border-[#C0C0C0]/40 text-sm text-black/80 whitespace-pre-wrap font-sans max-h-72 overflow-auto">
                                {s.statement_text}
                              </div>
                              <p className="text-xs text-black/50 mt-2">
                                Signed by <span className="font-medium text-black">{s.signature || '—'}</span>
                                {s.signed_at && ` on ${new Date(s.signed_at).toLocaleString()}`}
                                {s.ip_address && ` · IP ${s.ip_address}`}
                              </p>
                              {s.user_agent && <p className="text-[11px] text-black/40 mt-0.5 break-all">{s.user_agent}</p>}
                            </details>
                          )}

                          <div className="flex flex-wrap gap-2">
                            {s.status === 'pending' && (
                              <>
                                <button
                                  onClick={() => copyStatementInfo(s)}
                                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-[#C0C0C0]/60 bg-white text-black text-xs font-medium hover:border-[#D4AF37]"
                                >
                                  <Copy className="w-3.5 h-3.5" /> {isCopied ? 'Copied!' : 'Copy link & code'}
                                </button>
                                <button
                                  onClick={() => disableStatement(s.id)}
                                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-red-200 bg-white text-red-700 text-xs font-medium hover:bg-red-50"
                                >
                                  <ShieldOff className="w-3.5 h-3.5" /> Disable link
                                </button>
                              </>
                            )}
                            {s.status === 'submitted' && (
                              <button
                                onClick={() => downloadStatementPdf(s)}
                                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-[#D4AF37] text-black text-xs font-semibold hover:bg-[#B8961F]"
                              >
                                <Download className="w-3.5 h-3.5" /> Download Statement PDF
                              </button>
                            )}

                          </div>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </section>
            )}
          </div>



          {/* Sidebar: People to Contact — outreach status management */}
          <div>
            {isInvestigation && (
              <section className="bg-white rounded-2xl border border-[#C0C0C0]/40 p-6 sticky top-20 max-h-[calc(100vh-6rem)] overflow-auto">
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-lg font-semibold text-black">People to Contact</h2>
                  {contacts.length > 0 && (
                    <button
                      onClick={() => downloadContactsCsv(contacts, req.request_id)}
                      className="text-xs text-[#A8871F] hover:text-[#D4AF37] inline-flex items-center gap-1"
                    >
                      <Download className="w-3 h-3" /> CSV
                    </button>
                  )}
                </div>
                <p className="text-xs text-black/60 mb-4">
                  Update outreach status for each person. Status updates and witness statement links are visible to the client.
                </p>
                {contacts.length === 0 ? (
                  <p className="text-sm text-black/60">None added by client yet.</p>
                ) : (
                  <ul className="space-y-4 text-sm">
                    {contacts.map(c => {
                      const submittedStmts = statements.filter(s => s.status === 'submitted');
                      const linkedStmt = submittedStmts.find(s => s.id === c.linked_statement_id);
                      const notesDraft = contactNotesDraft[c.id] ?? c.admin_notes ?? '';
                      return (
                        <li key={c.id} className="p-3 rounded-lg border border-[#C0C0C0]/40 bg-[#FAF6EC]">
                          <p className="font-semibold text-black">{c.name}</p>
                          {c.role && <p className="text-black/60 text-xs">{c.role}</p>}
                          <p className="text-black/70 text-xs mt-1">{c.phone} {c.email && `· ${c.email}`}</p>
                          {c.notes && <p className="text-black/50 text-xs mt-1 italic">Client note: {c.notes}</p>}

                          {/* Outreach status selector */}
                          <div className="mt-3">
                            <label className="text-[10px] uppercase tracking-wide text-black/50 font-semibold block mb-1">
                              Outreach Status
                            </label>
                            <select
                              value={c.contact_status || 'Pending'}
                              onChange={e => updateContactStatus(c.id, e.target.value)}
                              className="w-full px-2 py-1.5 rounded-lg border border-teal/40 bg-white text-xs text-black focus:outline-none focus:border-teal focus:ring-2 focus:ring-teal/20"
                            >
                              {CONTACT_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                            </select>
                            <p className="text-[10px] text-black/40 mt-1">
                              Last updated: {c.last_status_update ? new Date(c.last_status_update).toLocaleString() : '—'}
                            </p>
                          </div>

                          {/* Admin notes (private to admin) */}
                          <div className="mt-2">
                            <label className="text-[10px] uppercase tracking-wide text-black/50 font-semibold block mb-1">
                              Admin Notes (private)
                            </label>
                            <textarea
                              value={notesDraft}
                              onChange={e => setContactNotesDraft(prev => ({ ...prev, [c.id]: e.target.value }))}
                              onBlur={() => {
                                if ((contactNotesDraft[c.id] ?? c.admin_notes ?? '') !== (c.admin_notes ?? '')) {
                                  saveContactAdminNotes(c.id);
                                }
                              }}
                              rows={2}
                              placeholder="Outreach notes, attempts made, scheduling info..."
                              className="w-full px-2 py-1.5 rounded-lg border border-[#C0C0C0]/60 bg-white text-xs text-black focus:outline-none focus:border-teal"
                            />
                          </div>

                          {/* Linked witness statement */}
                          <div className="mt-2">
                            <label className="text-[10px] uppercase tracking-wide text-black/50 font-semibold block mb-1">
                              Linked Witness Statement
                            </label>
                            <select
                              value={c.linked_statement_id || ''}
                              onChange={e => linkStatementToContact(c.id, e.target.value || null)}
                              className="w-full px-2 py-1.5 rounded-lg border border-[#C0C0C0]/60 bg-white text-xs text-black focus:outline-none focus:border-teal"
                            >
                              <option value="">— None —</option>
                              {submittedStmts.map(s => {
                                const label = [s.first_name, s.last_name].filter(Boolean).join(' ') || s.internal_label || `Statement ${s.id.slice(0, 6)}`;
                                return <option key={s.id} value={s.id}>{label}</option>;
                              })}
                            </select>
                            {linkedStmt && (
                              <button
                                onClick={() => downloadStatementPdf(linkedStmt)}
                                className="mt-2 inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-teal text-white text-[11px] font-semibold hover:bg-teal-700"
                              >
                                <Download className="w-3 h-3" /> Download Linked PDF
                              </button>
                            )}
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </section>
            )}
          </div>
        </div>
      </div>
      <Footer />
    </div>
  );
};

export default AdminRequestDetail;
