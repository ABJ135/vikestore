import { PrismaClient } from '../src/generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import * as bcrypt from 'bcrypt';
import 'dotenv/config';

async function main() {
  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
  const prisma = new PrismaClient({ adapter });

  const email = 'admin@vikestore.com';
  const existing = await prisma.admin.findUnique({ where: { email } });

  if (existing) {
    console.log('Admin already exists, skipping.');
    return;
  }

  const hashedPassword = await bcrypt.hash('ChangeMe123!', 10);

  const admin = await prisma.admin.create({
    data: {
      name: 'Super Admin',
      email,
      password: hashedPassword,
      role: 'ADMIN',
    },
  });

  console.log('Created admin:', admin.email);
}

main();