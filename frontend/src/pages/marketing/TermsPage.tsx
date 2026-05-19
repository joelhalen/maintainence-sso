import LegalPage from './LegalPage';

const SECTIONS = [
  {
    heading: '1. Acceptance of terms',
    body: [
      'By accessing or using MegaMTX, you agree to these Terms of Service. If you are using the Service on behalf of an organization, you represent that you have authority to bind that organization.',
    ],
  },
  {
    heading: '2. The Service',
    body: [
      'MegaMTX provides software for maintenance ticketing, asset tracking, notifications, reporting, and related administration. Features available to your account depend on your organization\'s subscription plan and assigned permissions.',
      'We may update the Service from time to time. Material changes will be communicated through release notes or administrator notices where practical.',
    ],
  },
  {
    heading: '3. Accounts & acceptable use',
    body: [
      'You are responsible for safeguarding your credentials and for activity under your account. You must not attempt to circumvent access controls, probe systems without authorization, upload malicious content, or use the Service in violation of applicable law.',
      'Organizations are responsible for user provisioning, role assignment, and compliance with their internal policies and regulatory obligations (including validated use of audit trails and electronic signatures where required).',
    ],
  },
  {
    heading: '4. Subscription & billing',
    body: [
      'Paid tiers are subject to usage limits described on the Pricing page. Billing through PayPal or other payment providers may be enabled in future releases; until then, plan assignment may be performed by platform administrators.',
      'Self-hosted Enterprise deployments are governed by separate written agreements covering support, updates, and data residency.',
    ],
  },
  {
    heading: '5. Intellectual property',
    body: [
      'MegaMTX software, branding, and documentation remain our property or that of our licensors. You retain ownership of operational data you submit. You grant us a limited license to host and process that data solely to provide the Service.',
    ],
  },
  {
    heading: '6. Disclaimers & limitation of liability',
    body: [
      'THE SERVICE IS PROVIDED "AS IS" WITHOUT WARRANTIES OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING MERCHANTABILITY OR FITNESS FOR A PARTICULAR PURPOSE. WE DO NOT WARRANT UNINTERRUPTED OR ERROR-FREE OPERATION.',
      'TO THE MAXIMUM EXTENT PERMITTED BY LAW, WE SHALL NOT BE LIABLE FOR INDIRECT, INCIDENTAL, SPECIAL, OR CONSEQUENTIAL DAMAGES ARISING FROM USE OF THE SERVICE. OUR AGGREGATE LIABILITY SHALL NOT EXCEED THE AMOUNTS PAID BY YOUR ORGANIZATION FOR THE SERVICE IN THE TWELVE MONTHS PRECEDING THE CLAIM.',
    ],
  },
  {
    heading: '7. Termination',
    body: [
      'Organizations may discontinue use at any time. We may suspend or terminate access for material breach, non-payment when billing is enabled, or risks to security and stability. Upon termination, export options may be available subject to plan entitlements and administrator action.',
    ],
  },
  {
    heading: '8. Governing law',
    body: [
      'These terms are governed by the laws specified in your organization\'s master service agreement for Enterprise customers, or otherwise by the jurisdiction of the platform operator for standard cloud accounts. Disputes shall be resolved in the courts of that jurisdiction unless otherwise agreed in writing.',
    ],
  },
];

export default function TermsPage() {
  return (
    <LegalPage
      title="Terms of Service"
      subtitle="Rules for using the MegaMTX maintenance management platform."
      lastUpdated="May 19, 2026"
      sections={SECTIONS}
    />
  );
}
