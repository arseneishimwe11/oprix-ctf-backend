import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');

  // Check if superadmin already exists
  const existingSuperAdmin = await prisma.user.findFirst({
    where: { role: 'SUPERADMIN' },
  });

  if (existingSuperAdmin) {
    console.log('SuperAdmin already exists');
    console.log(`Email: ${existingSuperAdmin.email}`);
    console.log(`Username: ${existingSuperAdmin.username}`);
    return;
  }

  // Create SuperAdmin account
  const password = process.env.SUPERADMIN_PASSWORD || 'SuperAdmin@2024!';
  const passwordHash = await bcrypt.hash(password, 10);

  const superAdmin = await prisma.user.create({
    data: {
      email: 'superadmin@oprix-ctf.com',
      username: 'superadmin',
      passwordHash,
      role: 'SUPERADMIN',
      isActive: true,
      clerkId: 'superadmin_seed', // Placeholder
    },
  });

  console.log('SuperAdmin created successfully!');
  console.log('');
  console.log('SuperAdmin Credentials:');
  console.log('Email:    superadmin@oprix-ctf.com');
  console.log('Username: superadmin');
  console.log('Password:', password);
  
  // Create audit log
  await prisma.auditLog.create({
    data: {
      userId: superAdmin.id,
      action: 'SUPERADMIN_SEED',
      entityType: 'User',
      entityId: superAdmin.id,
      details: { message: 'SuperAdmin account created via seed script' },
    },
  });
}

main()
  .catch((e) => {
    console.error('Error seeding database:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
