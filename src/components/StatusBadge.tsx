import React from 'react';

const COLORS: Record<string, string> = {
  'New Request': 'bg-[#FAF6EC] text-black border-[#C0C0C0]',
  'Pending Review': 'bg-[#C0C0C0]/30 text-black border-[#C0C0C0]',
  'Proposal Sent': 'bg-[#D4AF37]/20 text-[#7a6010] border-[#D4AF37]',
  'Change Requested': 'bg-orange-100 text-orange-800 border-orange-300',
  'Proposal Signed': 'bg-[#D4AF37]/30 text-[#7a6010] border-[#D4AF37]',
  'Assigning Investigator': 'bg-[#D4AF37]/40 text-black border-[#D4AF37]',
  'Investigator Assigned': 'bg-[#D4AF37]/50 text-black border-[#D4AF37]',
  'In Progress': 'bg-[#D4AF37] text-black border-[#A8871F]',
  'Investigation Complete': 'bg-black text-[#D4AF37] border-black',
};


const StatusBadge: React.FC<{ status: string }> = ({ status }) => {
  const cls = COLORS[status] || 'bg-gray-100 text-gray-800 border-gray-300';
  return (
    <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold border ${cls}`}>
      {status}
    </span>
  );
};

export default StatusBadge;
