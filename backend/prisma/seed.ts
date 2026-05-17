import { Permission, PrismaClient, SubscriptionTier } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

const SYSTEM_ROLES = [
  {
    name: 'Super Admin',
    description: 'Full system access',
    isSystem: true,
    permissions: Object.values(Permission),
  },
  {
    name: 'Admin',
    description: 'Administrative access without system settings',
    isSystem: true,
    permissions: [
      Permission.TICKET_CREATE, Permission.TICKET_READ, Permission.TICKET_UPDATE,
      Permission.TICKET_DELETE, Permission.TICKET_ASSIGN, Permission.TICKET_CLOSE,
      Permission.TICKET_EXPORT, Permission.USER_CREATE, Permission.USER_READ,
      Permission.USER_UPDATE, Permission.USER_ASSIGN_ROLE, Permission.LOCATION_CREATE,
      Permission.LOCATION_READ, Permission.LOCATION_UPDATE, Permission.ASSET_CREATE,
      Permission.ASSET_READ, Permission.ASSET_UPDATE, Permission.REPORT_VIEW,
      Permission.REPORT_EXPORT, Permission.ADMIN_PANEL, Permission.AUDIT_LOG_VIEW,
    ],
  },
  {
    name: 'Supervisor',
    description: 'Can manage tickets and assign technicians',
    isSystem: true,
    permissions: [
      Permission.TICKET_CREATE, Permission.TICKET_READ, Permission.TICKET_UPDATE,
      Permission.TICKET_ASSIGN, Permission.TICKET_CLOSE, Permission.TICKET_EXPORT,
      Permission.USER_READ, Permission.LOCATION_READ, Permission.ASSET_READ,
      Permission.ASSET_UPDATE, Permission.REPORT_VIEW, Permission.REPORT_EXPORT,
    ],
  },
  {
    name: 'Technician',
    description: 'Can work on assigned tickets',
    isSystem: true,
    permissions: [
      Permission.TICKET_CREATE, Permission.TICKET_READ, Permission.TICKET_UPDATE,
      Permission.LOCATION_READ, Permission.ASSET_READ,
    ],
  },
  {
    name: 'Operator',
    description: 'Can create and view tickets',
    isSystem: true,
    permissions: [
      Permission.TICKET_CREATE, Permission.TICKET_READ, Permission.LOCATION_READ,
      Permission.ASSET_READ,
    ],
  },
  {
    name: 'Viewer',
    description: 'Read-only access',
    isSystem: true,
    permissions: [
      Permission.TICKET_READ, Permission.LOCATION_READ, Permission.ASSET_READ,
    ],
  },
];

const SUBSCRIPTION_PLANS = [
  {
    tier: SubscriptionTier.FREE,
    name: 'Free',
    description: 'Starter plan for small teams validating MegaMTX.',
    monthlyPriceCents: 0,
    maxActiveUsers: 5,
    maxLocations: 1,
    maxAssets: 25,
    maxActiveTickets: 25,
    allowSms: false,
    allowSso: false,
    allowExports: false,
  },
  {
    tier: SubscriptionTier.STARTER,
    name: 'Starter',
    description: 'Entry cloud plan for single-site teams.',
    monthlyPriceCents: 4900,
    maxActiveUsers: 15,
    maxLocations: 3,
    maxAssets: 250,
    maxActiveTickets: 250,
    allowSms: true,
    allowSso: false,
    allowExports: true,
  },
  {
    tier: SubscriptionTier.PROFESSIONAL,
    name: 'Professional',
    description: 'Expanded plan for multi-site maintenance teams.',
    monthlyPriceCents: 14900,
    maxActiveUsers: 75,
    maxLocations: 25,
    maxAssets: 5000,
    maxActiveTickets: 2500,
    allowSms: true,
    allowSso: true,
    allowExports: true,
  },
  {
    tier: SubscriptionTier.ENTERPRISE,
    name: 'Enterprise',
    description: 'Custom managed cloud or self-hosted plan with unlimited usage caps.',
    monthlyPriceCents: null,
    maxActiveUsers: null,
    maxLocations: null,
    maxAssets: null,
    maxActiveTickets: null,
    allowSms: true,
    allowSso: true,
    allowExports: true,
  },
];

async function main() {
  console.log('Seeding database...');

  const organization = await prisma.organization.upsert({
    where: { slug: 'local-default' },
    update: { name: 'Local Development Organization', active: true },
    create: {
      name: 'Local Development Organization',
      slug: 'local-default',
    },
  });
  console.log(`  Organization: ${organization.name}`);

  for (const planData of SUBSCRIPTION_PLANS) {
    await prisma.subscriptionPlan.upsert({
      where: { tier: planData.tier },
      update: planData,
      create: planData,
    });
    console.log(`  Subscription Plan: ${planData.name}`);
  }

  const freePlan = await prisma.subscriptionPlan.findUnique({ where: { tier: SubscriptionTier.FREE } });
  if (!freePlan) throw new Error('Free subscription plan not found');

  await prisma.organizationSubscription.upsert({
    where: { organizationId: organization.id },
    update: { planId: freePlan.id, status: 'ACTIVE', provider: 'paypal' },
    create: {
      organizationId: organization.id,
      planId: freePlan.id,
      status: 'ACTIVE',
      provider: 'paypal',
    },
  });
  console.log('  Subscription: Free');

  for (const roleData of SYSTEM_ROLES) {
    await prisma.role.upsert({
      where: { organizationId_name: { organizationId: organization.id, name: roleData.name } },
      update: { permissions: roleData.permissions, description: roleData.description },
      create: { ...roleData, organizationId: organization.id },
    });
    console.log(`  Role: ${roleData.name}`);
  }

  const superAdminRole = await prisma.role.findUnique({
    where: { organizationId_name: { organizationId: organization.id, name: 'Super Admin' } },
  });
  if (!superAdminRole) throw new Error('Super Admin role not found');

  await prisma.user.upsert({
    where: { email: 'admin@megamtx.local' },
    update: { organizationId: organization.id, roleId: superAdminRole.id },
    create: {
      email: 'admin@megamtx.local',
      name: 'System Administrator',
      passwordHash: await bcrypt.hash('Admin@123!', 12),
      roleId: superAdminRole.id,
      organizationId: organization.id,
      department: 'IT',
      active: true,
    },
  });
  console.log('  Default admin user created: admin@megamtx.local');

  const defaultLocations = [
    { name: 'Main Facility', code: 'MAIN', description: 'Main production facility' },
  ];
  for (const loc of defaultLocations) {
    await prisma.location.upsert({
      where: { organizationId_code: { organizationId: organization.id, code: loc.code } },
      update: {},
      create: { ...loc, organizationId: organization.id },
    });
    console.log(`  Location: ${loc.name}`);
  }

  // Minimal neutral categories — administrators should configure categories
  // that match their facility type during initial setup.
  const defaultCategories = ['Equipment', 'Other'];
  for (const name of defaultCategories) {
    await prisma.assetCategory.upsert({
      where: { organizationId_name: { organizationId: organization.id, name } },
      update: {},
      create: { name, organizationId: organization.id },
    });
    console.log(`  Asset Category: ${name}`);
  }

  console.log('Seeding complete.');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
