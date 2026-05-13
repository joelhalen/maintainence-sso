import { PrismaClient, Permission } from '@prisma/client';
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

async function main() {
  console.log('Seeding database...');

  for (const roleData of SYSTEM_ROLES) {
    await prisma.role.upsert({
      where: { name: roleData.name },
      update: { permissions: roleData.permissions, description: roleData.description },
      create: roleData,
    });
    console.log(`  Role: ${roleData.name}`);
  }

  const superAdminRole = await prisma.role.findUnique({ where: { name: 'Super Admin' } });
  if (!superAdminRole) throw new Error('Super Admin role not found');

  await prisma.user.upsert({
    where: { email: 'admin@megafood.com' },
    update: {},
    create: {
      email: 'admin@megafood.com',
      name: 'System Administrator',
      passwordHash: await bcrypt.hash('Admin@123!', 12),
      roleId: superAdminRole.id,
      department: 'IT',
      active: true,
    },
  });
  console.log('  Default admin user created: admin@megafood.com');

  const defaultLocations = [
    { name: 'Main Facility', code: 'MAIN', description: 'Main production facility' },
  ];
  for (const loc of defaultLocations) {
    await prisma.location.upsert({
      where: { code: loc.code },
      update: {},
      create: loc,
    });
    console.log(`  Location: ${loc.name}`);
  }

  const defaultCategories = ['Machinery', 'HVAC', 'Electrical', 'Plumbing', 'Vehicle', 'Safety Equipment', 'IT Equipment', 'Other'];
  for (const name of defaultCategories) {
    await prisma.assetCategory.upsert({
      where: { name },
      update: {},
      create: { name },
    });
    console.log(`  Asset Category: ${name}`);
  }

  console.log('Seeding complete.');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
