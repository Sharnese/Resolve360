import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { Loader2, KeyRound, ShieldCheck, PenSquare, AlertTriangle, CheckCircle2, FileText } from 'lucide-react';

const SIGNATURE_FONTS = [
  { id: 'dancing', label: 'Dancing Script', css: '"Dancing Script", "Brush Script MT", cursive' },
  { id: 'great-vibes', label: 'Great Vibes', css: '"Great Vibes", "Apple Chancery", cursive' },
  { id: 'pacifico', label: 'Pacifico', css: '"Pacifico", "Lucida Handwriting", cursive' },
  { id: 'caveat', label: 'Caveat', css: '"Caveat", "Segoe Script", cursive' },
  { id: 'satisfy', label: 'Satisfy', css: '"Satisfy", "Bradley Hand", cursive' },
];

const FONTS_LINK_ID = 'r360-statement-fonts';
const ensureFontsLoaded = () => {
  if (typeof document === 'undefined') return;
  if (document.getElementById(FONTS_LINK_ID)) return;
  const link = document.createElement('link');
  link.id = FONTS_LINK_ID;
  link.rel = 'stylesheet';
  link.href = 'https://fonts.googleapis.com/css2?family=Caveat&family=Dancing+Script&family=Great+Vibes&family=Pacifico&family=Satisfy&display=swap';
  document.head.appendChild(link);
};

/**
 * Public statement submission page.
 * URL pattern: /statement/:token
 *
 * NOTE: `Shell` is defined OUTSIDE the component on purpose. Defining it inside
 * caused React to remount the entire form subtree on every keystroke, which
 * stole focus and made it look like the user could only type one letter at a
 * time in the textarea / signature inputs. Hoisting the wrapper fixes that.
 */
const Shell: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="min-h-screen bg-[#FAF6EC]">
    <header className="bg-black text-[#F5EFE0] py-4 px-6 border-b border-[#D4AF37]/30">
      <div className="max-w-3xl mx-auto flex items-center gap-3">
        <FileText className="w-5 h-5 text-[#D4AF37]" />
        <span className="font-semibold tracking-wide">Resolve360 — Written Statement</span>
      </div>
    </header>
    <main className="max-w-3xl mx-auto px-4 sm:px-6 py-10">{children}</main>
    <footer className="text-center text-xs text-black/50 pb-8">
      Confidential. This portal is provided by Resolve360 for the secure capture of written statements.
      <br />
      <Link to="/" className="text-[#A8871F] hover:text-[#D4AF37]">Return to Resolve360</Link>
    </footer>
  </div>
);

const StatementSubmission: React.FC = () => {
  const { token } = useParams();

  const [loading, setLoading] = useState(true);
  const [stmt, setStmt] = useState<any>(null);
  const [error, setError] = useState('');

  // Unlock flow
  const [accessCode, setAccessCode] = useState('');
  const [unlocked, setUnlocked] = useState(false);
  const [unlockError, setUnlockError] = useState('');

  // Submission form
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [statementText, setStatementText] = useState('');
  const [signature, setSignature] = useState('');
  const [signatureFont, setSignatureFont] = useState(SIGNATURE_FONTS[0].id);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [confirmFinalize, setConfirmFinalize] = useState(false);

  useEffect(() => { ensureFontsLoaded(); }, []);

  useEffect(() => {
    const load = async () => {
      if (!token) { setError('Missing link.'); setLoading(false); return; }
      const { data, error: err } = await supabase
        .from('investigation_statements')
        .select('*')
        .eq('link_token', token)
        .maybeSingle();
      if (err) {
        setError('Unable to load this statement link.');
      } else if (!data) {
        setError('This statement link is invalid or has been removed.');
      } else {
        setStmt(data);
        setFirstName(data.first_name || '');
        setLastName(data.last_name || '');
      }
      setLoading(false);
    };
    load();
  }, [token]);

  const tryUnlock = (e: React.FormEvent) => {
    e.preventDefault();
    setUnlockError('');
    if (!stmt) return;
    if ((accessCode || '').trim().toUpperCase() === (stmt.password_code || '').toUpperCase()) {
      setUnlocked(true);
    } else {
      setUnlockError('Incorrect access code. Please double-check the code provided by Resolve360.');
    }
  };

  const submitStatement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stmt) return;
    if (!statementText.trim()) { setError('Please write your statement before submitting.'); return; }
    if (!signature.trim()) { setError('Please type your full name as your e-signature.'); return; }
    if (!confirmFinalize) { setError('Please confirm you understand your signature will be finalized.'); return; }
    setSubmitting(true);
    setError('');

    // Best-effort IP capture (non-fatal if it fails).
    let ip: string | null = null;
    try {
      const r = await fetch('https://api.ipify.org?format=json');
      if (r.ok) {
        const j = await r.json();
        ip = j.ip || null;
      }
    } catch { /* ignore */ }

    const { error: updErr } = await supabase
      .from('investigation_statements')
      .update({
        first_name: firstName || stmt.first_name,
        last_name: lastName || stmt.last_name,
        statement_text: statementText,
        signature,
        signature_font: signatureFont,
        signed_at: new Date().toISOString(),
        submitted_at: new Date().toISOString(),
        status: 'submitted',
        ip_address: ip,
        user_agent: navigator.userAgent || null,
      })
      .eq('id', stmt.id);

    if (updErr) {
      setError('Failed to submit your statement. Please try again.');
      setSubmitting(false);
      return;
    }
    setSubmitted(true);
    setSubmitting(false);
  };

  const fontCss = SIGNATURE_FONTS.find(f => f.id === signatureFont)?.css || 'cursive';

  // ----- Render states -----

  if (loading) {
    return (
      <div className="min-h-screen bg-[#FAF6EC] flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-[#D4AF37]" />
      </div>
    );
  }
  // Shell is hoisted above the component to prevent remount-on-keystroke.


  if (!stmt) {
    return (
      <Shell>
        <div className="bg-white rounded-2xl border border-red-200 p-8 text-center">
          <AlertTriangle className="w-10 h-10 text-red-500 mx-auto mb-3" />
          <h1 className="text-xl font-bold text-black mb-2">Invalid Link</h1>
          <p className="text-black/60">{error || 'This statement link is invalid.'}</p>
        </div>
      </Shell>
    );
  }

  if (stmt.status === 'submitted' || submitted) {
    return (
      <Shell>
        <div className="bg-white rounded-2xl border border-green-200 p-8 text-center">
          <CheckCircle2 className="w-12 h-12 text-green-600 mx-auto mb-3" />
          <h1 className="text-2xl font-bold text-black mb-2">Statement Submitted</h1>
          <p className="text-black/60 mb-2">
            Thank you. Your written statement has been securely delivered to Resolve360.
          </p>
          <p className="text-xs text-black/50">
            This link has been retired and can no longer be used.
          </p>
        </div>
      </Shell>
    );
  }

  if (stmt.status === 'expired' || stmt.disabled_at) {
    return (
      <Shell>
        <div className="bg-white rounded-2xl border border-[#C0C0C0]/40 p-8 text-center">
          <AlertTriangle className="w-10 h-10 text-orange-500 mx-auto mb-3" />
          <h1 className="text-xl font-bold text-black mb-2">Link No Longer Active</h1>
          <p className="text-black/60">
            This statement link has been disabled. Please contact Resolve360 if you still need to provide a statement.
          </p>
        </div>
      </Shell>
    );
  }

  if (!unlocked) {
    return (
      <Shell>
        <div className="bg-white rounded-2xl border border-[#C0C0C0]/40 p-8">
          <div className="flex items-center gap-2 mb-2">
            <KeyRound className="w-5 h-5 text-[#D4AF37]" />
            <h1 className="text-xl font-bold text-black">Enter Your Access Code</h1>
          </div>
          <p className="text-sm text-black/60 mb-5">
            Resolve360 issued you an access code along with this link. Enter it below to begin
            your written statement. The code is case-insensitive.
          </p>
          <form onSubmit={tryUnlock} className="space-y-4">
            <input
              autoFocus
              value={accessCode}
              onChange={e => setAccessCode(e.target.value)}
              placeholder="Access code"
              className="w-full px-4 py-3 rounded-lg border border-[#C0C0C0]/60 bg-white font-mono tracking-widest text-lg focus:outline-none focus:border-[#D4AF37]"
            />
            {unlockError && <p className="text-sm text-red-700">{unlockError}</p>}
            <button
              type="submit"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-lg bg-[#D4AF37] text-black font-semibold hover:bg-[#B8961F]"
            >
              <ShieldCheck className="w-4 h-4" /> Unlock
            </button>
          </form>
        </div>
      </Shell>
    );
  }

  // Unlocked — show form.
  return (
    <Shell>
      <div className="bg-white rounded-2xl border border-[#C0C0C0]/40 p-6 md:p-8">
        <div className="mb-5">
          <p className="text-[#D4AF37] text-xs font-semibold tracking-widest uppercase mb-1">Confidential Statement</p>
          <h1 className="text-2xl font-bold text-black">Write Your Statement</h1>
          <p className="text-sm text-black/60 mt-1">
            Please describe what you witnessed or what you would like Resolve360 to know, in your own words.
            Take your time — be specific with dates, times, names, and locations where possible.
          </p>
        </div>

        <form onSubmit={submitStatement} className="space-y-5">
          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-black mb-1">First Name</label>
              <input
                value={firstName}
                onChange={e => setFirstName(e.target.value)}
                className="w-full px-4 py-2.5 rounded-lg border border-[#C0C0C0]/60 bg-white focus:outline-none focus:border-[#D4AF37]"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-black mb-1">Last Name</label>
              <input
                value={lastName}
                onChange={e => setLastName(e.target.value)}
                className="w-full px-4 py-2.5 rounded-lg border border-[#C0C0C0]/60 bg-white focus:outline-none focus:border-[#D4AF37]"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-black mb-1">Your Statement *</label>
            <textarea
              value={statementText}
              onChange={e => setStatementText(e.target.value)}
              rows={12}
              required
              placeholder="Describe what happened, who was involved, where it happened, when it happened, and any other details you feel are important..."
              className="w-full px-4 py-3 rounded-lg border border-[#C0C0C0]/60 bg-white focus:outline-none focus:border-[#D4AF37] font-sans text-sm"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-black mb-1">Type your full name to e-sign *</label>
            <input
              value={signature}
              onChange={e => setSignature(e.target.value)}
              required
              placeholder="Full legal name"
              className="w-full px-4 py-3 rounded-lg border border-[#C0C0C0]/60 bg-white focus:outline-none focus:border-[#D4AF37]"
            />
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2 mt-3">
              {SIGNATURE_FONTS.map(f => (
                <button
                  type="button"
                  key={f.id}
                  onClick={() => setSignatureFont(f.id)}
                  className={`p-3 rounded-lg border text-left transition ${signatureFont === f.id ? 'border-[#D4AF37] ring-2 ring-[#D4AF37]/30 bg-[#D4AF37]/5' : 'border-[#C0C0C0]/60 hover:border-[#D4AF37]'}`}
                >
                  <div className="text-xl text-black truncate" style={{ fontFamily: f.css }}>
                    {signature || 'Your Name'}
                  </div>
                  <div className="text-[10px] text-black/50 mt-0.5">{f.label}</div>
                </button>
              ))}
            </div>
            {signature && (
              <div className="mt-3 p-3 rounded-lg bg-[#FAF6EC] border border-[#C0C0C0]/40">
                <p className="text-xs uppercase tracking-wide text-black/50 mb-1">Signature preview</p>
                <p className="text-3xl text-black" style={{ fontFamily: fontCss }}>{signature}</p>
              </div>
            )}
          </div>

          <div className="p-4 rounded-lg border border-orange-200 bg-orange-50">
            <label className="flex items-start gap-2 text-sm text-black cursor-pointer">
              <input
                type="checkbox"
                checked={confirmFinalize}
                onChange={e => setConfirmFinalize(e.target.checked)}
                className="mt-0.5 w-4 h-4 accent-[#D4AF37]"
              />
              <span>
                <strong>Once submitted, your signature will be finalized.</strong> You will not be able to
                edit or resubmit this statement. By signing, you confirm the statement is true and accurate
                to the best of your knowledge.
              </span>
            </label>
          </div>

          {error && <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">{error}</div>}

          <button
            type="submit"
            disabled={submitting}
            className="w-full inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-lg bg-[#D4AF37] text-black font-semibold hover:bg-[#B8961F] disabled:opacity-50"
          >
            {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <PenSquare className="w-4 h-4" />}
            {submitting ? 'Submitting...' : 'Sign & Submit Statement'}
          </button>
        </form>
      </div>
    </Shell>
  );
};

export default StatementSubmission;
