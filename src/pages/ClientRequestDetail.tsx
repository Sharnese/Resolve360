import React, { useEffect, useState } from 'react';
import { Navigate, useParams, Link } from 'react-router-dom';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import StatusBadge from '@/components/StatusBadge';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { sendNotification } from '@/lib/notify';
import { ArrowLeft, Upload, Plus, Trash2, FileText, Loader2, Download, PenSquare, MessageSquareWarning, X, Eye, CheckCircle2 } from 'lucide-react';
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

const ClientRequestDetail: React.FC = () => {
  const { id } = useParams();
  const { user, profile, loading } = useAuth();
  const [req, setReq] = useState<any>(null);
  const [contract, setContract] = useState<any>(null);
  const [docs, setDocs] = useState<any[]>([]);
  const [contacts, setContacts] = useState<any[]>([]);
  const [reports, setReports] = useState<any[]>([]);
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
    // Determine if both signatures will be in place after this sign-off.
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
    // reset input
    e.target.value = '';
    await load();
  };

  const addContact = async () => {
    if (!newContact.name.trim()) return;
    await supabase.from('investigation_contacts').insert({ request_id: req.id, ...newContact });
    setNewContact({ name: '', role: '', phone: '', email: '', notes: '' });
    sendNotification('contacts_added', req.id);
    await load();
  };

  const removeContact = async (cid: string) => {
    await supabase.from('investigation_contacts').delete().eq('id', cid);
    await load();
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

        {/* Overview */}
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

        {/* Contract — available for ALL service types (investigation or otherwise) */}
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

                {/* Always-available contract download */}
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

                {/* Admin signature display — always visible once admin signs */}
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
            {/* Documents */}

            <section className="bg-white rounded-2xl border border-[#C0C0C0]/40 p-6 mb-6">
              <h2 className="text-lg font-semibold text-black mb-2">Upload Documents</h2>
              <p className="text-sm text-black/60 mb-4">Upload supporting documents for the investigation.</p>
              <div className="grid sm:grid-cols-2 gap-2 mb-3">
                <input
                  className="w-full px-4 py-2 rounded-lg border border-[#C0C0C0]/60"
                  placeholder="Document title (optional)"
                  value={docTitle}
                  onChange={e => setDocTitle(e.target.value)}
                />
                <input
                  className="w-full px-4 py-2 rounded-lg border border-[#C0C0C0]/60"
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
                        <a href={d.file_url} target="_blank" rel="noopener noreferrer" className="text-sm text-black/60 hover:text-[#D4AF37] inline-flex items-center gap-1">
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

            {/* People to Contact */}
            <section className="bg-white rounded-2xl border border-[#C0C0C0]/40 p-6 mb-6">
              <h2 className="text-lg font-semibold text-black mb-4">People to Contact</h2>
              <div className="grid sm:grid-cols-2 gap-3 mb-3">
                <input className="px-4 py-2 rounded-lg border border-[#C0C0C0]/60" placeholder="Name *" value={newContact.name} onChange={e => setNewContact({ ...newContact, name: e.target.value })} />
                <input className="px-4 py-2 rounded-lg border border-[#C0C0C0]/60" placeholder="Role" value={newContact.role} onChange={e => setNewContact({ ...newContact, role: e.target.value })} />
                <input className="px-4 py-2 rounded-lg border border-[#C0C0C0]/60" placeholder="Phone" value={newContact.phone} onChange={e => setNewContact({ ...newContact, phone: e.target.value })} />
                <input className="px-4 py-2 rounded-lg border border-[#C0C0C0]/60" placeholder="Email" value={newContact.email} onChange={e => setNewContact({ ...newContact, email: e.target.value })} />
                <input className="px-4 py-2 rounded-lg border border-[#C0C0C0]/60 sm:col-span-2" placeholder="Notes" value={newContact.notes} onChange={e => setNewContact({ ...newContact, notes: e.target.value })} />
              </div>
              <button onClick={addContact} className="inline-flex items-center gap-2 px-5 py-2 rounded-lg bg-[#D4AF37] text-black font-semibold hover:bg-[#B8961F]">
                <Plus className="w-4 h-4" /> Add Person
              </button>
              {contacts.length > 0 && (
                <ul className="mt-5 space-y-2">
                  {contacts.map(c => (
                    <li key={c.id} className="flex items-start justify-between p-3 rounded-lg border border-[#C0C0C0]/40 bg-[#FAF6EC]">
                      <div className="text-sm">
                        <p className="font-semibold text-black">{c.name} <span className="text-black/50 font-normal">{c.role && `— ${c.role}`}</span></p>
                        <p className="text-black/60">{c.phone} {c.email && `· ${c.email}`}</p>
                        {c.notes && <p className="text-black/50 text-xs mt-1">{c.notes}</p>}
                      </div>
                      <button onClick={() => removeContact(c.id)} className="text-red-600 hover:text-red-800 p-1">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            {/* Final Investigation Document */}
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
                          <a href={r.file_url} target="_blank" rel="noopener noreferrer" className="text-sm text-black/60 hover:text-[#D4AF37] inline-flex items-center gap-1">
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

        {/* Documents available for non-investigation services if uploaded by admin and visible */}
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

      <Footer />
    </div>
  );
};

export default ClientRequestDetail;
