export const SERVICES = [
  {
    id: 'investigation',
    name: 'Certified Investigation ODP',
    summary: 'When incidents occur, agencies need a timely, objective, and compliant response. Resolve360 provides certified investigation support designed to help agencies gather facts, identify concerns, and move toward resolution with confidence.',
    includes: [
      'Incident review',
      'Interviews and documentation review',
      'Evidence collection',
      'Findings summary',
      'Recommendations',
      'ODP-aligned investigation support',
    ],
  },
  {
    id: 'cap',
    name: 'Corrective Action Plans',
    summary: 'Many agencies know there is a problem but need help creating a corrective action plan that is realistic, organized, and sustainable. Resolve360 assesses the issue, identifies root causes, and develops a clear plan for correction and follow-up.',
    includes: [
      'System assessment',
      'Compliance gap review',
      'Root cause identification',
      'Corrective action plan development',
      'Implementation steps',
      'Follow-up procedures',
    ],
  },
  {
    id: 'documentation',
    name: 'Documentation Training',
    summary: 'Poor documentation can create serious compliance risks even when services are being delivered. Resolve360 trains teams to document clearly, consistently, and in alignment with regulatory expectations.',
    includes: [
      'Documentation best practices',
      'Service note training',
      'Incident documentation guidance',
      'Common documentation errors',
      'Staff training sessions',
      'Optional documentation review',
    ],
  },
  {
    id: 'automation',
    name: 'Process and Systems Automation',
    summary: 'Manual processes and disconnected systems slow agencies down and increase the risk of missed tasks, poor tracking, and compliance gaps. Resolve360 helps agencies streamline workflows and create more efficient systems.',
    includes: [
      'Needs assessment',
      'Workflow review',
      'Process improvement recommendations',
      'Automation planning',
      'Implementation plan',
      'Optional implementation support',
    ],
  },
  {
    id: 'digital',
    name: 'Digital Solutions',
    summary: 'Agencies need simple tools that provide visibility, accountability, and real-time insight. Resolve360 creates practical digital solutions such as trackers, chatbots, and KPI dashboards to help teams stay organized and informed.',
    includes: [
      'Digital trackers',
      'KPI dashboards',
      'Chatbots',
      'Compliance tracking tools',
      'Staff performance trackers',
      'Custom workflow tools',
    ],
  },
];

export const SERVICE_NAMES = SERVICES.map(s => s.name);

export const STATUS_FLOW = [
  'New Request',
  'Pending Review',
  'Proposal Sent',
  'Change Requested',
  'Proposal Signed',
  'Assigning Investigator',
  'Investigator Assigned',
  'In Progress',
  'Investigation Complete',
];
