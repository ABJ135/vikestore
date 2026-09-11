import { Injectable, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service'; // adjust path to wherever your PrismaService lives

@Injectable()
export class DbKeepAliveService implements OnModuleInit {
  constructor(private prisma: PrismaService) {}

  onModuleInit() {
    setInterval(async () => {
      try {
        await this.prisma.$queryRaw`SELECT 1`;
      } catch (err) {
        console.error('DB keep-alive failed:', err);
      }
    }, 4 * 60 * 1000);
  }
}