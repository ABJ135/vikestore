import { PrismaClient } from '../src/generated/prisma/client.js';
import { PrismaPg } from '@prisma/adapter-pg';
import * as bcrypt from 'bcrypt';
import 'dotenv/config';

async function main() {
  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
  const prisma = new PrismaClient({ adapter });

  // ── Seed admin ─────────────────────────────────────────────────────────────
  const email =
    process.env.STORE_ADMIN_EMAIL ??
    `admin@${process.env.STORE_SLUG ?? 'store'}.com`;

  const existing = await prisma.admin.findUnique({ where: { email } });

  if (existing) {
    console.log('Admin already exists, skipping.');
  } else {
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

  // ── Seed default store settings ────────────────────────────────────────────
  const settingsCount = await prisma.storeSetting.count();

  if (settingsCount === 0) {
    await prisma.storeSetting.create({
      data: {
        storeName: process.env.STORE_NAME ?? 'My Store',
        supportEmail: email,
        currency: 'USD',
      },
    });
    console.log('Created default store settings.');
  } else {
    console.log('Store settings already exist, skipping.');
  }
}

main();