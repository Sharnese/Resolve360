import { supabase } from '@/lib/supabase';

export interface ContractData {
  companyName: string;
  date: string;
  investigationTitle: string;
  price: number | string;
  primaryContactName: string;
  consultantName?: string;
}

export const generateContractText = (d: ContractData): string => {
  return `Resolve360 Investigation Agreement

This Agreement is entered into between ${d.consultantName || 'Sharnese Jones'} / Resolve360 and ${d.companyName} as of ${d.date}.

1. Scope of Services
Resolve360 will conduct a Certified Investigation ODP-aligned regarding:
Investigation Title: ${d.investigationTitle}
Services may include documentation review, interviews, analysis, findings, and recommendations.

2. Client Responsibilities
Client agrees to provide accurate information, submit relevant documentation, and provide access to necessary individuals for interviews.

3. Fees
Total Fee: $${d.price}
Payment is due after findings are submitted to the Client and within 3 business days of submission.
Mileage reimbursement is included in the fee up to 50 miles.

4. Timeline
The investigation will typically be completed within 5 to 30 business days, depending on complexity, availability of information, and client responsiveness.

5. Confidentiality
All information shared will be handled confidentially and used only for the purpose of completing the investigation.

6. Limitation of Services
Resolve360 provides independent investigative services and recommendations. Final decisions and implementation remain the responsibility of the Client.

7. Acceptance
Client Name: ${d.primaryContactName}
Company: ${d.companyName}
Consultant: ${d.consultantName || 'Sharnese Jones'} / Resolve360`;
};

// Generic Resolve360 Service Agreement template — used for any non-investigation service.
// Keeps the same overall sections as the investigation template so PDF rendering and
// signature/version tracking work without any branching.
export interface GenericContractData {
  companyName: string;
  date: string;
  serviceTitle: string;
  serviceList: string[];
  price: number | string;
  primaryContactName: string;
  consultantName?: string;
}

export const generateGenericContractText = (d: GenericContractData): string => {
  const services = (d.serviceList && d.serviceList.length) ? d.serviceList.join(', ') : d.serviceTitle;
  const priceLine = d.price === '' || d.price === null || d.price === undefined ? 'To be determined' : `$${d.price}`;
  return `Resolve360 Service Agreement

This Agreement is entered into between ${d.consultantName || 'Sharnese Jones'} / Resolve360 and ${d.companyName} as of ${d.date}.

Service(s): ${services}

1. Scope of Services
Resolve360 agrees to provide the requested professional services as outlined in the service request submission and related communications.

2. Client Responsibilities
The client agrees to provide accurate information, required documentation, and timely communication necessary for service completion.

3. Confidentiality
All information shared during the course of services will be handled confidentially unless disclosure is required by law.

4. No Guarantee Clause
Resolve360 will make reasonable professional efforts to complete the requested services but does not guarantee specific outcomes.

5. Payment Terms
Total Fee: ${priceLine}
Payment terms, fees, and applicable invoices shall be governed by the agreed service arrangement.

6. Electronic Signature
By signing below, the client agrees that their electronic signature is legally binding.

7. Acceptance
Client Name: ${d.primaryContactName}
Company: ${d.companyName}
Consultant: ${d.consultantName || 'Sharnese Jones'} / Resolve360`;
};


// Compute a friendly contract status label from a contract row.
// Status progression:
//   draft -> sent -> admin_signed -> signed (client) -> fully_executed
export const computeContractStatus = (c: any): string => {
  if (!c) return '';
  const hasAdmin = !!c.admin_signature;
  const hasClient = !!c.client_signature;
  if (hasAdmin && hasClient) return 'Fully Executed';
  if (hasClient) return 'User Signed';
  if (hasAdmin) return 'Admin Signed';
  if (c.status === 'change_requested') return 'Change Requested';
  if (c.status === 'resubmitted') return 'Resubmitted';
  if (c.status === 'sent') return 'Sent to User';
  return 'Draft';
};

// Build a downloadable text version of the contract appending any signatures present.
// Kept for legacy/back-compat; PDF generation is now the primary download path.
export const buildContractDownloadText = (contract: any): string => {
  if (!contract?.contract_text) return '';
  let txt = contract.contract_text;
  const lines: string[] = [];
  if (contract.admin_signature && contract.admin_signed_at) {
    const who = contract.admin_signed_by_name ? ` (${contract.admin_signed_by_name})` : '';
    lines.push(`— Signed by Resolve360${who}: ${contract.admin_signature} on ${new Date(contract.admin_signed_at).toLocaleString()}`);
  }
  if (contract.client_signature && contract.signed_at) {
    lines.push(`— Signed by Client: ${contract.client_signature} on ${new Date(contract.signed_at).toLocaleString()}`);
  }
  if (lines.length) txt += `\n\n${lines.join('\n')}`;
  return txt;
};

const sanitizeForFilename = (s: string): string =>
  (s || 'Client').replace(/[^a-zA-Z0-9._-]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 80) || 'Client';

// Pick a filename label per the spec:
//   Contract_[UserName]_Draft.pdf
//   Contract_[UserName]_v1.pdf
//   Contract_[UserName]_Fully_Executed.pdf
export const buildContractFileLabel = (contract: any): string => {
  if (!contract) return 'Draft';
  const fully = !!(contract.admin_signature && contract.client_signature);
  if (fully) return 'Fully_Executed';
  if (contract.client_signature) return `User_Signed_v${contract.version_number || 1}`;
  if (contract.admin_signature) return `Admin_Signed_v${contract.version_number || 1}`;
  if (contract.status === 'sent' || contract.status === 'resubmitted') return `v${contract.version_number || 1}`;
  return 'Draft';
};

/**
 * Generate the contract PDF server-side and trigger a browser download.
 * Falls back to a .txt download if the edge function is unreachable so users
 * are never stuck without a copy of the contract.
 */
export const downloadContractPdf = async (opts: {
  contract: any;
  userName: string;
  fileNameLabel?: string;
}): Promise<void> => {
  const { contract, userName } = opts;
  if (!contract) return;
  const fullyExecuted = !!(contract.admin_signature && contract.client_signature);
  const fileNameLabel = opts.fileNameLabel || buildContractFileLabel(contract);
  const statusLabel = computeContractStatus(contract);
  const versionLabel = `v${contract.version_number || 1}`;

  try {
    const { data, error } = await supabase.functions.invoke('resolve360-contract-pdf', {
      body: {
        contract,
        bodyText: contract.contract_text || '',
        statusLabel,
        versionLabel,
        userName,
        fileNameLabel,
        fullyExecuted,
      },
    });
    if (error) throw error;

    // supabase-js returns a Blob when the response Content-Type isn't JSON.
    let blob: Blob;
    if (data instanceof Blob) {
      blob = data;
    } else if (data instanceof ArrayBuffer) {
      blob = new Blob([data], { type: 'application/pdf' });
    } else if (typeof data === 'string') {
      // Last resort: treat as binary string
      const bytes = new Uint8Array(data.length);
      for (let i = 0; i < data.length; i++) bytes[i] = data.charCodeAt(i) & 0xff;
      blob = new Blob([bytes], { type: 'application/pdf' });
    } else {
      throw new Error('Unexpected PDF response type');
    }

    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Contract_${sanitizeForFilename(userName)}_${sanitizeForFilename(fileNameLabel)}.pdf`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  } catch (err) {
    console.error('PDF download failed, falling back to text:', err);
    const txt = buildContractDownloadText(contract);
    if (!txt) {
      alert('Unable to generate contract download. Please try again.');
      return;
    }
    const blob = new Blob([txt], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Contract_${sanitizeForFilename(userName)}_${sanitizeForFilename(fileNameLabel)}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }
};
