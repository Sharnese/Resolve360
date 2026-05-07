import React, { useEffect, useState } from 'react';
import { Navigate, useParams, Link } from 'react-router-dom';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import StatusBadge from '@/components/StatusBadge';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { sendNotification } from '@/lib/notify';
import { ArrowLeft, Upload, Plus, Trash2, FileText, Loader2, Download, PenSquare, MessageSquareWarning, X, Eye, CheckCircle2, Edit3, Save, Users, ClipboardList } from 'lucide-react';
import { computeContractStatus, downloadContractPdf } from '@/lib/contract';

const SIGNATURE_FONTS = [
  { id: 'dancing', label: 'Dancing Script', css: '"Dancing Script", "Brush Script MT", cursive' },
  { id: 'great-vibes', label: 'Great Vibes', css: '"Great Vibes", "Apple Chancery", cursive' },
  { id: 'pacifico', label: 'Pacifico', css: '"Pacifico", "Lucida Handwriting", cursive' },
  { id: 'caveat', label: 'Caveat', css: '"Caveat", "Segoe Script", cursive' },
  { id: 'satisfy', label: 'Satisfy', css: '"Satisfy", "Bradley Hand", cursive' },
];

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

// Trigger a server-generated PDF download for the contract at any stage.
const downloadContractPdfFor = async (contract: any, userName: string, fileNameLabel?: string) => {
  await downloadContractPdf({ contract, userName, fileNameLabel });
};

const formatBytes = (n?: number | null) => {
  if (!n) return '';
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
};

// Allowed contact-outreach statuses (mirrors admin list).
const CONTACT_STATUSES = ['Pending', 'Contacted', 'Scheduled', 'Interviewed', 'Unable to Reach'] as const;

const contactStatusBadgeCls = (s?: string) => {
  switch (s) {
    case 'Contacted': return 'bg-teal/10 text-teal-700 border-teal/30';
    case 'Scheduled': return 'bg-blue-50 text-blue-700 border-blue-200';
    case 'Interviewed': return 'bg-green-50 text-green-700 border-green-200';
    case 'Unable to Reach': return 'bg-red-50 text-red-700 border-red-200';
    default: return 'bg-[#FAF6EC] text-black/70 border-[#C0C0C0]/60';
  }
};

const ClientRequestDetail: React.FC = () => {
  const { id } = useParams();
  const { user, profile, loading } = useAuth();
  const [req, setReq] = useState<any>(null);
  const [contract, setContract] = useState<any>(null);
  const [docs, setDocs] = useState<any[]>([]);
  const [contacts, setContacts] = useState<any[]>([]);
  const [reports, setReports] = useState<any[]>([]);
  const [statements, setStatements] = useState<any[]>([]);
  const [busy, setBusy] = useState(true);
  const [signature, setSignature] = useState('');
  const [signatureFont, setSignatureFont] = useState(SIGNATURE_FONTS[0].id);
  const [signing, setSigning] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [docTitle, setDocTitle] = useState('');
  const [docNotes, setDocNotes] = useState('');
  const [newContact, setNewContact] = useState({ name: '', role: '', phone: '', email: '', notes: '' });
  const [showChangeModal, setShowChangeModal] = useState(false);
  const [changeNotes, setChangeNotes] = useState('');
  const [submittingChange, setSubmittingChange] = useState(false);

  // Inline edit state for People to Contact (user-editable fields only).
  const [editingContactId, setEditingContactId] = useState<string | null>(null);
  const [contactDraft, setContactDraft] = useState<{ name: string; role: string; phone: string; email: string; notes: string }>({
    name: '', role: '', phone: '', email: '', notes: '',
  });

  // Statement viewer modal state
  const [viewStatement, setViewStatement] = useState<any | null>(null);

  useEffect(() => { ensureFontsLoaded(); }, []);

  const load = async () => {
    if (!id) return;
    const { data: r } = await supabase.from('service_requests').select('*').eq('id', id).maybeSingle();
    setReq(r);
    // Active contract version
    const { data: c } = await supabase
      .from('contracts').select('*').eq('request_id', id)
      .eq('is_active_version', true).order('created_at', { ascending: false }).limit(1).maybeSingle();
    setContract(c);
    const { data: d } = await supabase.from('investigation_documents').select('*').eq('request_id', id).order('created_at', { ascending: false });
    setDocs(d || []);
    const { data: ct } = await supabase.from('investigation_contacts').select('*').eq('request_id', id).order('created_at');
    setContacts(ct || []);
    // Only show client-visible final reports
    const { data: fr } = await supabase
      .from('final_reports').select('*').eq('request_id', id)
      .eq('visible_to_client', true).order('created_at', { ascending: false });
    setReports(fr || []);
    // Only show submitted (completed) witness statements to the client.
    const { data: stmts } = await supabase
      .from('investigation_statements').select('*').eq('request_id', id)
      .eq('status', 'submitted').order('submitted_at', { ascending: false });
    setStatements(stmts || []);
    setBusy(false);
  };

  useEffect(() => { load(); }, [id]);

  if (loading) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="w-6 h-6 animate-spin text-[#D4AF37]" /></div>;
  if (!user) return <Navigate to="/login" />;
  if (profile?.role === 'admin') return <Navigate to={`/admin/request/${id}`} />;

  const isInvestigation = req?.selected_services?.includes('Certified Investigation ODP');
  const fontCss = SIGNATURE_FONTS.find(f => f.id === signatureFont)?.css || 'cursive';

  const signContract = async () => {
    if (!signature.trim() || !contract) return;
    setSigning(true);
    const fullyExecuted = !!contract.admin_signature;
    const newContractStatus = fullyExecuted ? 'fully_executed' : 'signed';
    await supabase.from('contracts').update({
      client_signature: signature,
      signature_font: signatureFont,
      signed_at: new Date().toISOString(),
      status: newContractStatus,
    }).eq('id', contract.id);
    await supabase.from('service_requests').update({ status: 'Proposal Signed', updated_at: new Date().toISOString() }).eq('id', req.id);
    sendNotification('contract_signed', req.id);
    if (fullyExecuted) sendNotification('contract_fully_executed', req.id);
    sendNotification('status_changed', req.id, { newStatus: 'Proposal Signed' });
    setSigning(false);
    await load();
  };

  const submitChangeRequest = async () => {
    if (!changeNotes.trim() || !contract) return;
    setSubmittingChange(true);
    await supabase.from('contracts').update({
      change_request_notes: changeNotes,
      change_requested_at: new Date().toISOString(),
      status: 'change_requested',
    }).eq('id', contract.id);
    await supabase.from('service_requests').update({ status: 'Change Requested', updated_at: new Date().toISOString() }).eq('id', req.id);
    sendNotification('contract_change_requested', req.id, { changeNotes });
    sendNotification('status_changed', req.id, { newStatus: 'Change Requested' });
    setSubmittingChange(false);
    setShowChangeModal(false);
    setChangeNotes('');
    await load();
  };

  const uploadDoc = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setUploading(true);
    let uploadedAny = false;
    for (const file of Array.from(files)) {
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
      const path = `${req.id}/${Date.now()}-${safeName}`;
      const { error } = await supabase.storage.from('investigation-documents').upload(path, file, {
        cacheControl: '3600', upsert: false, contentType: file.type || 'application/octet-stream',
      });
      if (error) {
        console.error('Upload error:', error);
        continue;
      }
      const { data: urlData } = supabase.storage.from('investigation-documents').getPublicUrl(path);
      const { error: insertErr } = await supabase.from('investigation_documents').insert({
        request_id: req.id,
        user_id: user.id,
        uploaded_by: user.id,
        uploaded_by_role: 'client',
        file_name: file.name,
        file_url: urlData.publicUrl,
        document_title: docTitle || null,
        notes: docNotes || null,
        file_type: file.type || null,
        file_size: file.size || null,
      });
      if (insertErr) console.error('Insert error:', insertErr);
      else uploadedAny = true;
    }
    setUploading(false);
    setDocTitle('');
    setDocNotes('');
    if (uploadedAny) sendNotification('documents_uploaded', req.id);
    e.target.value = '';
    await load();
  };

  // ---- People to Contact (user-editable fields only) ----
  const addContact = async () => {
    if (!newContact.name.trim()) return;
    await supabase.from('investigation_contacts').insert({
      request_id: req.id,
      ...newContact,
      contact_status: 'Pending',
      last_status_update: new Date().toISOString(),
    });
    setNewContact({ name: '', role: '', phone: '', email: '', notes: '' });
    sendNotification('contacts_added', req.id);
    await load();
  };

  const removeContact = async (cid: string) => {
    if (!confirm('Remove this contact from the investigation?')) return;
    await supabase.from('investigation_contacts').delete().eq('id', cid);
    await load();
  };

  const startEditContact = (c: any) => {
    setEditingContactId(c.id);
    setContactDraft({
      name: c.name || '', role: c.role || '', phone: c.phone || '', email: c.email || '', notes: c.notes || '',
    });
  };

  const cancelEditContact = () => {
    setEditingContactId(null);
    setContactDraft({ name: '', role: '', phone: '', email: '', notes: '' });
  };

  const saveContact = async (cid: string) => {
    if (!contactDraft.name.trim()) return;
    // User can ONLY edit name/role/phone/email/notes — never status, admin_notes,
    // last_status_update, or linked_statement_id. Admin status fields are intentionally omitted.
    await supabase.from('investigation_contacts').update({
      name: contactDraft.name,
      role: contactDraft.role,
      phone: contactDraft.phone,
      email: contactDraft.email,
      notes: contactDraft.notes,
      updated_at: new Date().toISOString(),
    }).eq('id', cid);
    sendNotification('contact_edited', req.id, { contactId: cid, contactName: contactDraft.name });
    setEditingContactId(null);
    await load();
  };

  // ---- Witness statement PDF download (client side) ----
  // Reuses the same server-side PDF generator as admin so output is identical.
  // ALWAYS produces a .pdf file — no Word/.doc/.docx/.txt fallbacks exist.
  const downloadStatementPdf = async (s: any) => {
    try {
      const fontLabel = SIGNATURE_FONTS.find(f => f.id === s.signature_font)?.label || s.signature_font || '';
      const { data, error } = await supabase.functions.invoke('resolve360-statement-pdf', {
        body: {
          statement: s,
          requestRef: req?.request_id || '',
          requestTitle: req?.investigation_title || '',
          adminRef: '',
          signatureFontLabel: fontLabel,
        },
      });
      if (error) throw error;
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

  if (busy || !req) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="w-6 h-6 animate-spin text-[#D4AF37]" /></div>;

  const nextStep = (() => {
    if (!isInvestigation) return 'Resolve360 will review your request and follow up shortly.';
    switch (req.status) {
      case 'New Request':
      case 'Pending Review': return 'Resolve360 is reviewing your request. We will send a proposal soon.';
      case 'Proposal Sent': return 'Review and e-sign the contract below to move forward.';
      case 'Change Requested': return 'Resolve360 has been notified of your requested changes and will reply with an updated contract.';
      case 'Proposal Signed':
      case 'Assigning Investigator': return 'Resolve360 is assigning an investigator to your case.';
      case 'Investigator Assigned':
      case 'In Progress': return 'Your investigator may request documents. Please respond to any messages from Resolve360.';
      case 'Investigation Complete': return 'Your investigation is complete. Download the final report below.';
      default: return '';
    }
  })();

  const contractStatusLabel = computeContractStatus(contract);
  const fullyExecuted = !!(contract?.admin_signature && contract?.client_signature);
  const adminFontCss = SIGNATURE_FONTS.find(f => f.id === contract?.admin_signature_font)?.css || 'cursive';

  return (
    <div className="min-h-screen bg-[#FAF6EC]">
      <Header />
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <Link to="/portal" className="inline-flex items-center gap-1 text-sm text-black/60 hover:text-black mb-4">
          <ArrowLeft className="w-4 h-4" /> Back to portal
        </Link>

        <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
          <div>
            <div className="text-xs text-black/50 mb-1">{req.request_id}</div>
            <h1 className="text-3xl font-bold text-black">{req.investigation_title || req.selected_services?.[0] || 'Request'}</h1>
          </div>
          <StatusBadge status={req.status} />
        </div>

        {nextStep && (
          <div className="mb-6 p-4 rounded-2xl bg-black text-[#F5EFE0] border border-[#D4AF37]/40 flex items-start gap-3">
            <div className="w-8 h-8 rounded-full bg-[#D4AF37] text-black flex items-center justify-center text-sm font-bold flex-shrink-0">→</div>
            <div>
              <p className="text-xs uppercase tracking-widest text-[#D4AF37] font-semibold mb-1">Next Step</p>
              <p className="text-sm">{nextStep}</p>
            </div>
          </div>
        )}

        {/* 1. Request Overview */}
        <section className="bg-white rounded-2xl border border-[#C0C0C0]/40 p-6 mb-6">
          <h2 className="text-lg font-semibold text-black mb-4">Request Overview</h2>
          <div className="grid sm:grid-cols-2 gap-4 text-sm">
            <div><dt className="text-black/50 text-xs uppercase tracking-wide mb-1">Services</dt><dd className="text-black">{(req.selected_services || []).join(', ')}</dd></div>
            <div><dt className="text-black/50 text-xs uppercase tracking-wide mb-1">Timeline</dt><dd className="text-black">{req.desired_start_timeline || '—'}</dd></div>
            <div className="sm:col-span-2">
              <dt className="text-black/50 text-xs uppercase tracking-wide mb-1">Availability</dt>
              {Array.isArray(req.availability_options) && req.availability_options.length > 0 ? (
                <ul className="space-y-1">
                  {req.availability_options.map((slot: any, i: number) => (
                    <li key={i} className="inline-flex items-center gap-2 px-3 py-1 rounded-md bg-[#FAF6EC] border border-[#C0C0C0]/40 text-sm text-black mr-2 mb-1">
                      <span className="font-medium">{slot.date ? new Date(slot.date + 'T00:00').toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' }) : '—'}</span>
                      <span className="text-black/60 text-xs">{slot.startTime || '—'}{slot.endTime ? ` – ${slot.endTime}` : ''}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <dd className="text-black">{req.availability_datetime ? new Date(req.availability_datetime).toLocaleString() : '—'}</dd>
              )}
            </div>

            {req.price && <div><dt className="text-black/50 text-xs uppercase tracking-wide mb-1">Price</dt><dd className="text-black font-semibold">${req.price}</dd></div>}
            <div className="sm:col-span-2"><dt className="text-black/50 text-xs uppercase tracking-wide mb-1">Description</dt><dd className="text-black whitespace-pre-wrap">{req.description || '—'}</dd></div>
            {req.client_visible_notes && (
              <div className="sm:col-span-2 bg-[#D4AF37]/10 border border-[#D4AF37]/30 p-4 rounded-lg">
                <dt className="text-[#7a6010] text-xs uppercase tracking-wide font-semibold mb-1">Note from Resolve360</dt>
                <dd className="text-black whitespace-pre-wrap">{req.client_visible_notes}</dd>
              </div>
            )}
            {req.assigned_investigator && (
              <div><dt className="text-black/50 text-xs uppercase tracking-wide mb-1">Assigned Investigator</dt><dd className="text-black font-medium">{req.assigned_investigator}</dd></div>
            )}
          </div>
        </section>

        {/* 2. Contract Section */}
        {contract && (
              <section className="bg-white rounded-2xl border border-[#C0C0C0]/40 p-6 mb-6">

                <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
                  <h2 className="text-lg font-semibold text-black flex items-center gap-2">
                    <FileText className="w-5 h-5 text-[#D4AF37]" /> {isInvestigation ? 'Investigation Agreement' : 'Service Agreement'}

                    {contract.version_number && contract.version_number > 1 && (
                      <span className="text-xs font-normal text-black/50">v{contract.version_number}</span>
                    )}
                  </h2>
                  <span className="text-xs px-2.5 py-1 rounded-full border bg-[#FAF6EC] border-[#C0C0C0]/60 text-black/70">
                    {contractStatusLabel}
                  </span>
                </div>
                <pre className="whitespace-pre-wrap text-sm text-black/80 bg-[#FAF6EC] border border-[#C0C0C0]/40 rounded-lg p-4 max-h-96 overflow-auto font-sans">{contract.contract_text}</pre>

                <div className="mt-3">
                  <button
                    onClick={() => downloadContractPdfFor(contract, `${profile?.first_name || ''}_${profile?.last_name || 'Client'}`.trim() || 'Client', fullyExecuted ? 'Fully_Executed' : (contract.client_signature ? `User_Signed_v${contract.version_number || 1}` : `v${contract.version_number || 1}`))}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-[#C0C0C0]/60 bg-white text-black text-sm font-medium hover:border-[#D4AF37]"
                  >
                    <Download className="w-4 h-4" /> {contract.client_signature ? 'Download Signed Contract' : 'Download Current Contract'}
                  </button>
                </div>

                {contract.change_request_notes && contract.status === 'change_requested' && (
                  <div className="mt-4 p-4 rounded-lg bg-orange-50 border border-orange-200">
                    <p className="text-xs uppercase tracking-wide font-semibold text-orange-800 mb-1">Your requested changes</p>
                    <p className="text-sm text-black whitespace-pre-wrap">{contract.change_request_notes}</p>
                    <p className="text-xs text-black/50 mt-2">Submitted {new Date(contract.change_requested_at).toLocaleString()}. Resolve360 will reply with an updated contract.</p>
                  </div>
                )}

                {contract.admin_signature && (
                  <div className="mt-4 p-4 rounded-lg bg-[#D4AF37]/10 border border-[#D4AF37]/30">
                    <p className="text-xs uppercase tracking-wide text-[#7a6010] font-semibold mb-1">Signed by Resolve360</p>
                    <p className="text-3xl text-black" style={{ fontFamily: adminFontCss }}>
                      {contract.admin_signature}
                    </p>
                    <p className="text-xs text-black/60 mt-1">
                      {contract.admin_signed_by_name ? `${contract.admin_signed_by_name} · ` : ''}
                      Signed on {new Date(contract.admin_signed_at).toLocaleString()}
                    </p>
                  </div>
                )}

                {fullyExecuted && (
                  <div className="mt-3 p-3 rounded-lg bg-green-50 border border-green-200 inline-flex items-center gap-2 text-sm text-green-800">
                    <CheckCircle2 className="w-4 h-4" /> Contract is fully executed. Both Resolve360 and you have signed.
                  </div>
                )}

                {contract.client_signature ? (
                  <div className="mt-4 p-4 rounded-lg bg-[#D4AF37]/10 border border-[#D4AF37]/30">
                    <p className="text-xs uppercase tracking-wide text-[#7a6010] font-semibold mb-2">Signed by Client (You)</p>
                    <p
                      className="text-3xl text-black"
                      style={{ fontFamily: SIGNATURE_FONTS.find(f => f.id === contract.signature_font)?.css || 'cursive' }}
                    >
                      {contract.client_signature}
                    </p>
                    <p className="text-xs text-black/60 mt-1">Signed on {new Date(contract.signed_at).toLocaleString()}</p>
                  </div>
                ) : (
                  <div className="mt-4 space-y-3">
                    <label className="block text-sm font-medium text-black">Type your full name to e-sign</label>
                    <input
                      className="w-full px-4 py-3 rounded-lg border border-[#C0C0C0]/60 bg-white focus:border-[#D4AF37] focus:outline-none focus:ring-2 focus:ring-[#D4AF37]/20"
                      value={signature}
                      onChange={e => setSignature(e.target.value)}
                      placeholder="Full legal name"
                    />
                    <div>
                      <label className="block text-sm font-medium text-black mb-2">Choose a signature style</label>
                      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2">
                        {SIGNATURE_FONTS.map(f => (
                          <button
                            type="button"
                            key={f.id}
                            onClick={() => setSignatureFont(f.id)}
                            className={`p-3 rounded-lg border text-left transition ${signatureFont === f.id ? 'border-[#D4AF37] ring-2 ring-[#D4AF37]/30 bg-[#D4AF37]/5' : 'border-[#C0C0C0]/60 hover:border-[#D4AF37]'}`}
                          >
                            <div className="text-2xl text-black truncate" style={{ fontFamily: f.css }}>
                              {signature || 'Your Name'}
                            </div>
                            <div className="text-[11px] text-black/50 mt-1">{f.label}</div>
                          </button>
                        ))}
                      </div>
                    </div>
                    {signature && (
                      <div className="p-4 rounded-lg bg-[#FAF6EC] border border-[#C0C0C0]/40">
                        <p className="text-xs uppercase tracking-wide text-black/50 mb-1">Preview</p>
                        <p className="text-4xl text-black" style={{ fontFamily: fontCss }}>{signature}</p>
                      </div>
                    )}
                    <div className="p-3 rounded-lg bg-orange-50 border border-orange-200 text-sm text-orange-900">
                      <strong>Once submitted, your signature will be finalized.</strong> You will not be able to edit or revoke it after signing.
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <button
                        onClick={signContract}
                        disabled={signing || !signature.trim()}
                        className="inline-flex items-center gap-2 px-6 py-3 rounded-lg bg-[#D4AF37] text-black font-semibold hover:bg-[#B8961F] disabled:opacity-50"
                      >
                        <PenSquare className="w-4 h-4" /> {signing ? 'Signing...' : 'E-Sign Contract'}
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowChangeModal(true)}
                        className="inline-flex items-center gap-2 px-6 py-3 rounded-lg border border-[#C0C0C0]/60 bg-white text-black font-semibold hover:bg-[#FAF6EC]"
                      >
                        <MessageSquareWarning className="w-4 h-4" /> Request Changes
                      </button>
                    </div>
                  </div>
                )}
              </section>
            )}

        {isInvestigation && (
          <>
            {/* 3. People to Contact */}
            <section className="bg-white rounded-2xl border border-[#C0C0C0]/40 p-6 mb-6">
              <div className="flex items-center justify-between gap-2 mb-1">
                <h2 className="text-lg font-semibold text-black flex items-center gap-2">
                  <Users className="w-5 h-5 text-teal" /> People to Contact
                </h2>
                <span className="text-xs text-black/50">{contacts.length} {contacts.length === 1 ? 'person' : 'people'}</span>
              </div>
              <p className="text-sm text-black/60 mb-4">
                Resolve360 will reach out to these people as part of the investigation. Track outreach status here.
                You may edit contact info you submitted at any time. Status updates are managed by Resolve360.
              </p>

              {/* Add new contact */}
              <div className="grid sm:grid-cols-2 gap-3 mb-3">
                <input className="px-4 py-2 rounded-lg border border-[#C0C0C0]/60 focus:border-teal focus:outline-none" placeholder="Name *" value={newContact.name} onChange={e => setNewContact({ ...newContact, name: e.target.value })} />
                <input className="px-4 py-2 rounded-lg border border-[#C0C0C0]/60 focus:border-teal focus:outline-none" placeholder="Relationship / Role" value={newContact.role} onChange={e => setNewContact({ ...newContact, role: e.target.value })} />
                <input className="px-4 py-2 rounded-lg border border-[#C0C0C0]/60 focus:border-teal focus:outline-none" placeholder="Phone" value={newContact.phone} onChange={e => setNewContact({ ...newContact, phone: e.target.value })} />
                <input className="px-4 py-2 rounded-lg border border-[#C0C0C0]/60 focus:border-teal focus:outline-none" placeholder="Email" value={newContact.email} onChange={e => setNewContact({ ...newContact, email: e.target.value })} />
                <input className="px-4 py-2 rounded-lg border border-[#C0C0C0]/60 focus:border-teal focus:outline-none sm:col-span-2" placeholder="Notes" value={newContact.notes} onChange={e => setNewContact({ ...newContact, notes: e.target.value })} />
              </div>
              <button onClick={addContact} className="inline-flex items-center gap-2 px-5 py-2 rounded-lg bg-[#D4AF37] text-black font-semibold hover:bg-[#B8961F]">
                <Plus className="w-4 h-4" /> Add Person
              </button>

              {contacts.length > 0 && (
                <ul className="mt-5 space-y-3">
                  {contacts.map(c => {
                    const isEditing = editingContactId === c.id;
                    return (
                      <li key={c.id} className="p-4 rounded-lg border border-[#C0C0C0]/40 bg-[#FAF6EC]">
                        {isEditing ? (
                          <div className="space-y-2">
                            <div className="grid sm:grid-cols-2 gap-2">
                              <input className="px-3 py-2 rounded-lg border border-[#C0C0C0]/60 bg-white focus:border-teal focus:outline-none" placeholder="Name *" value={contactDraft.name} onChange={e => setContactDraft({ ...contactDraft, name: e.target.value })} />
                              <input className="px-3 py-2 rounded-lg border border-[#C0C0C0]/60 bg-white focus:border-teal focus:outline-none" placeholder="Relationship / Role" value={contactDraft.role} onChange={e => setContactDraft({ ...contactDraft, role: e.target.value })} />
                              <input className="px-3 py-2 rounded-lg border border-[#C0C0C0]/60 bg-white focus:border-teal focus:outline-none" placeholder="Phone" value={contactDraft.phone} onChange={e => setContactDraft({ ...contactDraft, phone: e.target.value })} />
                              <input className="px-3 py-2 rounded-lg border border-[#C0C0C0]/60 bg-white focus:border-teal focus:outline-none" placeholder="Email" value={contactDraft.email} onChange={e => setContactDraft({ ...contactDraft, email: e.target.value })} />
                              <input className="px-3 py-2 rounded-lg border border-[#C0C0C0]/60 bg-white focus:border-teal focus:outline-none sm:col-span-2" placeholder="Notes" value={contactDraft.notes} onChange={e => setContactDraft({ ...contactDraft, notes: e.target.value })} />
                            </div>
                            <div className="flex gap-2">
                              <button onClick={() => saveContact(c.id)} disabled={!contactDraft.name.trim()} className="inline-flex items-center gap-1 px-4 py-1.5 rounded-lg bg-teal text-white text-sm font-semibold hover:bg-teal-700 disabled:opacity-50">
                                <Save className="w-3.5 h-3.5" /> Save Changes
                              </button>
                              <button onClick={cancelEditContact} className="inline-flex items-center gap-1 px-4 py-1.5 rounded-lg border border-[#C0C0C0]/60 bg-white text-black text-sm hover:bg-[#FAF6EC]">
                                Cancel
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="flex items-start justify-between gap-3">
                            <div className="text-sm flex-1 min-w-0">
                              <div className="flex flex-wrap items-center gap-2 mb-1">
                                <p className="font-semibold text-black">{c.name}</p>
                                {c.role && <span className="text-black/60 text-xs">— {c.role}</span>}
                                <span className={`text-[11px] px-2 py-0.5 rounded-full border font-medium uppercase tracking-wide ${contactStatusBadgeCls(c.contact_status)}`}>
                                  {c.contact_status || 'Pending'}
                                </span>
                              </div>
                              {(c.phone || c.email) && (
                                <p className="text-black/70 text-xs">{c.phone}{c.phone && c.email ? ' · ' : ''}{c.email}</p>
                              )}
                              {c.notes && <p className="text-black/60 text-xs mt-1">{c.notes}</p>}
                              <p className="text-[11px] text-black/40 mt-1">
                                Last status update: {c.last_status_update ? new Date(c.last_status_update).toLocaleString() : '—'}
                              </p>
                            </div>
                            <div className="flex items-center gap-2 flex-shrink-0">
                              <button onClick={() => startEditContact(c)} className="text-teal hover:text-teal-700 p-1" title="Edit Contact">
                                <Edit3 className="w-4 h-4" />
                              </button>
                              <button onClick={() => removeContact(c.id)} className="text-red-600 hover:text-red-800 p-1" title="Remove">
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </div>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>

            {/* 4. Witness Statements */}
            <section className="bg-white rounded-2xl border border-[#C0C0C0]/40 p-6 mb-6">
              <div className="flex items-center justify-between gap-2 mb-1">
                <h2 className="text-lg font-semibold text-black flex items-center gap-2">
                  <ClipboardList className="w-5 h-5 text-teal" /> Witness Statements
                </h2>
                <span className="text-xs text-black/50">{statements.length} completed</span>
              </div>
              <p className="text-sm text-black/60 mb-4">
                Completed witness statements connected to your investigation appear here. All downloads are PDF only.
              </p>
              {statements.length === 0 ? (
                <p className="text-sm text-black/60 italic">No witness statements have been completed yet. They will appear here once submitted.</p>
              ) : (
                <ul className="space-y-2">
                  {statements.map(s => {
                    const witnessName = [s.first_name, s.last_name].filter(Boolean).join(' ') || 'Witness';
                    return (
                      <li key={s.id} className="p-4 rounded-lg border border-[#C0C0C0]/40 bg-[#FAF6EC]">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className="font-semibold text-black">{witnessName}</p>
                              <span className="text-[11px] px-2 py-0.5 rounded-full border bg-green-50 text-green-700 border-green-200 font-medium uppercase tracking-wide">
                                Completed
                              </span>
                            </div>
                            <p className="text-xs text-black/50 mt-0.5">
                              Submitted {s.submitted_at ? new Date(s.submitted_at).toLocaleString() : '—'}
                            </p>
                          </div>
                          <div className="flex items-center gap-2 flex-shrink-0">
                            <button
                              onClick={() => setViewStatement(s)}
                              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-[#C0C0C0]/60 bg-white text-black text-xs font-medium hover:border-teal hover:text-teal"
                            >
                              <Eye className="w-3.5 h-3.5" /> View
                            </button>
                            <button
                              onClick={() => downloadStatementPdf(s)}
                              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-[#D4AF37] text-black text-xs font-semibold hover:bg-[#B8961F]"
                            >
                              <Download className="w-3.5 h-3.5" /> Download PDF
                            </button>
                          </div>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>

            {/* 5. Uploaded Documents */}
            <section className="bg-white rounded-2xl border border-[#C0C0C0]/40 p-6 mb-6">
              <h2 className="text-lg font-semibold text-black mb-2">Upload Documents</h2>
              <p className="text-sm text-black/60 mb-4">Upload supporting documents for the investigation.</p>
              <div className="grid sm:grid-cols-2 gap-2 mb-3">
                <input
                  className="w-full px-4 py-2 rounded-lg border border-[#C0C0C0]/60 focus:border-teal focus:outline-none"
                  placeholder="Document title (optional)"
                  value={docTitle}
                  onChange={e => setDocTitle(e.target.value)}
                />
                <input
                  className="w-full px-4 py-2 rounded-lg border border-[#C0C0C0]/60 focus:border-teal focus:outline-none"
                  placeholder="Notes (optional)"
                  value={docNotes}
                  onChange={e => setDocNotes(e.target.value)}
                />
              </div>
              <label className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-black text-[#D4AF37] font-semibold cursor-pointer hover:bg-[#1a1410] transition">
                <Upload className="w-4 h-4" /> {uploading ? 'Uploading...' : 'Choose Files'}
                <input type="file" multiple className="hidden" onChange={uploadDoc} disabled={uploading} />
              </label>
              {docs.length > 0 && (
                <ul className="mt-5 space-y-2">
                  {docs.map(d => (
                    <li key={d.id} className="flex items-center justify-between p-3 rounded-lg border border-[#C0C0C0]/40 bg-[#FAF6EC]">
                      <div className="flex items-start gap-2 text-sm min-w-0 flex-1">
                        <FileText className="w-4 h-4 text-[#D4AF37] mt-0.5 flex-shrink-0" />
                        <div className="min-w-0 flex-1">
                          <p className="text-black font-medium truncate">{d.document_title || d.file_name}</p>
                          {d.document_title && d.document_title !== d.file_name && (
                            <p className="text-xs text-black/50 truncate">{d.file_name}</p>
                          )}
                          {d.notes && <p className="text-xs text-black/50 truncate">{d.notes}</p>}
                          <p className="text-[11px] text-black/40 mt-0.5">
                            {new Date(d.created_at).toLocaleDateString()} {d.file_size ? `· ${formatBytes(d.file_size)}` : ''}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 flex-shrink-0">
                        <a href={d.file_url} target="_blank" rel="noopener noreferrer" className="text-sm text-black/60 hover:text-teal inline-flex items-center gap-1">
                          <Eye className="w-4 h-4" />
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

            {/* 6. Final Documents / Reports */}
            <section className="bg-white rounded-2xl border border-[#C0C0C0]/40 p-6 mb-6">
              <h2 className="text-lg font-semibold text-black mb-4">Final Investigation Document</h2>
              {reports.length === 0 ? (
                <p className="text-sm text-black/60">The final investigation document will appear here once Resolve360 uploads and releases it.</p>
              ) : (
                <ul className="space-y-2">
                  {reports.map(r => (
                    <li key={r.id} className="p-3 rounded-lg border border-[#C0C0C0]/40 bg-[#FAF6EC]">
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2 text-sm min-w-0 flex-1">
                          <FileText className="w-4 h-4 text-[#D4AF37] flex-shrink-0" />
                          <div className="min-w-0">
                            <p className="text-black font-medium truncate">{r.file_name}</p>
                            <p className="text-[11px] text-black/40">Uploaded {new Date(r.created_at).toLocaleDateString()}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3 flex-shrink-0">
                          <a href={r.file_url} target="_blank" rel="noopener noreferrer" className="text-sm text-black/60 hover:text-teal inline-flex items-center gap-1">
                            <Eye className="w-4 h-4" /> View
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
          </>
        )}

        {/* Documents available for non-investigation services */}
        {!isInvestigation && reports.length > 0 && (
          <section className="bg-white rounded-2xl border border-[#C0C0C0]/40 p-6 mb-6">
            <h2 className="text-lg font-semibold text-black mb-4">Documents from Resolve360</h2>
            <ul className="space-y-2">
              {reports.map(r => (
                <li key={r.id} className="flex items-center justify-between p-3 rounded-lg border border-[#C0C0C0]/40 bg-[#FAF6EC]">
                  <div className="flex items-center gap-2 text-sm">
                    <FileText className="w-4 h-4 text-[#D4AF37]" />
                    <span className="text-black font-medium">{r.file_name}</span>
                  </div>
                  <a href={r.file_url} download={r.file_name} className="text-sm text-[#A8871F] hover:text-[#D4AF37] inline-flex items-center gap-1">
                    <Download className="w-4 h-4" /> Download
                  </a>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>

      {/* Request changes modal */}
      {showChangeModal && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4" onClick={() => setShowChangeModal(false)}>
          <div className="bg-white rounded-2xl border border-[#C0C0C0]/40 max-w-lg w-full p-6 shadow-xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-start justify-between mb-3">
              <div>
                <h3 className="text-lg font-bold text-black">Request Contract Changes</h3>
                <p className="text-sm text-black/60">Tell Resolve360 what you'd like adjusted before signing.</p>
              </div>
              <button onClick={() => setShowChangeModal(false)} className="p-1 rounded hover:bg-[#FAF6EC]">
                <X className="w-5 h-5 text-black/50" />
              </button>
            </div>
            <textarea
              className="w-full px-4 py-3 rounded-lg border border-[#C0C0C0]/60 focus:outline-none focus:border-[#D4AF37]"
              rows={6}
              placeholder="Describe the changes you'd like..."
              value={changeNotes}
              onChange={e => setChangeNotes(e.target.value)}
            />
            <div className="flex justify-end gap-2 mt-4">
              <button onClick={() => setShowChangeModal(false)} className="px-4 py-2 rounded-lg border border-[#C0C0C0]/60 text-black hover:bg-[#FAF6EC]">Cancel</button>
              <button
                onClick={submitChangeRequest}
                disabled={submittingChange || !changeNotes.trim()}
                className="inline-flex items-center gap-2 px-5 py-2 rounded-lg bg-[#D4AF37] text-black font-semibold hover:bg-[#B8961F] disabled:opacity-50"
              >
                {submittingChange && <Loader2 className="w-4 h-4 animate-spin" />}
                Submit Changes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Statement viewer modal */}
      {viewStatement && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4" onClick={() => setViewStatement(null)}>
          <div className="bg-white rounded-2xl border border-[#C0C0C0]/40 max-w-2xl w-full p-6 shadow-xl max-h-[90vh] overflow-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-start justify-between mb-4 gap-4">
              <div>
                <p className="text-xs uppercase tracking-widest text-teal font-semibold mb-1">Witness Statement</p>
                <h3 className="text-xl font-bold text-black">
                  {[viewStatement.first_name, viewStatement.last_name].filter(Boolean).join(' ') || 'Witness'}
                </h3>
                <p className="text-xs text-black/50 mt-1">
                  Submitted {viewStatement.submitted_at ? new Date(viewStatement.submitted_at).toLocaleString() : '—'}
                </p>
              </div>
              <button onClick={() => setViewStatement(null)} className="p-1 rounded hover:bg-[#FAF6EC]">
                <X className="w-5 h-5 text-black/50" />
              </button>
            </div>
            <div className="p-4 rounded-lg bg-[#FAF6EC] border border-[#C0C0C0]/40 text-sm text-black whitespace-pre-wrap font-sans mb-4">
              {viewStatement.statement_text || '—'}
            </div>
            {viewStatement.signature && (
              <div className="p-3 rounded-lg bg-[#D4AF37]/10 border border-[#D4AF37]/30 mb-4">
                <p className="text-[11px] uppercase tracking-wide text-[#7a6010] font-semibold mb-1">E-Signature</p>
                <p
                  className="text-2xl text-black"
                  style={{ fontFamily: SIGNATURE_FONTS.find(f => f.id === viewStatement.signature_font)?.css || 'cursive' }}
                >
                  {viewStatement.signature}
                </p>
                <p className="text-[11px] text-black/50 mt-1">
                  {viewStatement.signed_at ? `Signed on ${new Date(viewStatement.signed_at).toLocaleString()}` : ''}
                </p>
              </div>
            )}
            <div className="flex justify-end gap-2">
              <button onClick={() => setViewStatement(null)} className="px-4 py-2 rounded-lg border border-[#C0C0C0]/60 text-black hover:bg-[#FAF6EC]">Close</button>
              <button
                onClick={() => downloadStatementPdf(viewStatement)}
                className="inline-flex items-center gap-2 px-5 py-2 rounded-lg bg-[#D4AF37] text-black font-semibold hover:bg-[#B8961F]"
              >
                <Download className="w-4 h-4" /> Download PDF
              </button>
            </div>
          </div>
        </div>
      )}

      <Footer />
    </div>
  );
};

export default ClientRequestDetail;
