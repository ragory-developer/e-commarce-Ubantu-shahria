import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  const email = process.env.SUPER_ADMIN_EMAIL || 'admin@example.com';
  const password = process.env.SUPER_ADMIN_PASSWORD || 'admin@example.com';
  const firstName = process.env.SUPER_ADMIN_FIRST_NAME || 'Super';
  const lastName = process.env.SUPER_ADMIN_LAST_NAME || 'Admin';
  const saltRounds = parseInt(process.env.BCRYPT_ROUNDS || '12', 10);

  console.log('Seeding super admin:', email);

  const hashed = await bcrypt.hash(password, saltRounds);

  const admin = await prisma.admin.upsert({
    where: { email },
    update: {
      password: hashed,
      firstName,
      lastName,
      isActive: true,
      deletedAt: null,
      updatedAt: new Date(),
    },
    create: {
      firstName,
      lastName,
      email,
      password: hashed,
      role: 'SUPERADMIN',
      permissions: [],
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  });

  console.log('✅ Super admin seeded:', admin.email);
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
