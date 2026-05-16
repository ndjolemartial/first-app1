import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database…');

  const existing = await prisma.user.findUnique({ where: { email: 'admin@afrikimmo.ci' } });
  if (existing) {
    console.log('Admin user already exists, skipping.');
    return;
  }

  const password = await bcrypt.hash('Admin@123', 12);
  const user = await prisma.user.create({
    data: {
      matricule: 'ADM-001',
      firstName: 'Super',
      lastName: 'Admin',
      email: 'admin@afrikimmo.ci',
      password,
      role: 'SUPER_ADMIN',
      isActive: true,
    },
  });

  console.log(`✓ Admin created: ${user.email} / password: Admin@123`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
