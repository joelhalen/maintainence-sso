import LegalPage from './LegalPage';

const SECTIONS = [
  {
    heading: '1. Introduction',
    body: [
      'MegaMTX ("we", "our", or "the Service") provides maintenance ticket and asset management software. This Privacy Policy describes how we collect, use, and protect information when you use our web application and mobile clients.',
      'If you access MegaMTX through your employer or another organization, that organization is the data controller for operational data you enter into the system. We process such data on their instructions as a processor.',
    ],
  },
  {
    heading: '2. Information we collect',
    body: [
      'Account information: name, email address, role, department, and authentication credentials (stored as salted password hashes or via your identity provider when SSO is enabled).',
      'Operational data: maintenance tickets, assets, locations, attachments, audit log entries, electronic signatures, and notification preferences you or your administrators create.',
      'Technical data: device tokens for push notifications, IP addresses and request metadata in server logs, and session tokens required to keep you signed in.',
    ],
  },
  {
    heading: '3. How we use information',
    body: [
      'We use collected information to provide and secure the Service, deliver email and push notifications, enforce subscription entitlements, produce audit records, and improve reliability.',
      'We do not sell personal information. We may share data with subprocessors that host infrastructure (e.g., cloud hosting, email delivery, Firebase for push) under agreements that require appropriate safeguards.',
    ],
  },
  {
    heading: '4. Retention & security',
    body: [
      'Data is retained for as long as your organization maintains an account or as required by applicable law and your organization\'s policies. Audit logs are append-only by design to support compliance workflows.',
      'We apply industry-standard measures including encrypted transport (HTTPS), access controls, and role-based permissions. No method of transmission over the Internet is 100% secure; organizations should configure SSO and strong password policies where appropriate.',
    ],
  },
  {
    heading: '5. Your rights',
    body: [
      'Depending on your jurisdiction, you may have rights to access, correct, or delete personal data. Contact your organization administrator first; they can action requests within MegaMTX or coordinate with us for hosted deployments.',
    ],
  },
  {
    heading: '6. Contact',
    body: [
      'For privacy questions regarding a hosted MegaMTX deployment, contact the administrator listed for your organization or the platform operator identified in your service agreement.',
    ],
  },
];

export default function PrivacyPage() {
  return (
    <LegalPage
      title="Privacy Policy"
      subtitle="How MegaMTX handles personal and operational data."
      lastUpdated="May 19, 2026"
      sections={SECTIONS}
    />
  );
}
