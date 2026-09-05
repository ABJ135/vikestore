import { ConflictException, ForbiddenException, Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import { RegisterCustomerDto } from './dto/register-customer.dto';
import { LoginDto } from './dto/login.dto';
import { JwtModuleOptions } from '@nestjs/jwt';
import { CreateEmployeeDto } from './dto/create-employee.dto';

type ExpiresIn = NonNullable<JwtModuleOptions['signOptions']>['expiresIn'];


@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) { }

  async registerCustomer(dto: RegisterCustomerDto) {
    const existing = await this.prisma.customer.findUnique({
      where: { email: dto.email },
    });

    if (existing) {
      throw new ConflictException('Email already registered');
    }

    const hashedPassword = await bcrypt.hash(dto.password, 10);

    const customer = await this.prisma.customer.create({
      data: {
        name: dto.name,
        email: dto.email,
        password: hashedPassword,
        phone: dto.phone,
      },
    });

    const { password, ...result } = customer;
    return result;
  }

  async loginCustomer(dto: LoginDto) {
    const customer = await this.prisma.customer.findUnique({
      where: { email: dto.email },
    });

    if (!customer) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const passwordMatches = await bcrypt.compare(dto.password, customer.password);

    if (!passwordMatches) {
      throw new UnauthorizedException('Invalid credentials');
    }

    return this.issueTokensForCustomer(customer.id, customer.name, customer.email);
  }

  async refreshCustomerTokens(refreshToken: string) {
    let payload: { sub: string; type: string };

    try {
      payload = await this.jwtService.verifyAsync(refreshToken, {
        secret: process.env.JWT_REFRESH_SECRET,
      });
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }

    const tokenHash = this.hashToken(refreshToken);

    const stored = await this.prisma.customerRefreshToken.findFirst({
      where: {
        customerId: payload.sub,
        tokenHash,
        revokedAt: null,
        expiresAt: { gt: new Date() },
      },
    });

    if (!stored) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    // Rotate: revoke the old one, issue a new pair
    await this.prisma.customerRefreshToken.update({
      where: { id: stored.id },
      data: { revokedAt: new Date() },
    });

    const customer = await this.prisma.customer.findUnique({
      where: { id: payload.sub },
    });

    if (!customer || !customer.isActive) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    return this.issueTokensForCustomer(customer.id, customer.name, customer.email);
  }

  async logoutCustomer(refreshToken: string) {
    const tokenHash = this.hashToken(refreshToken);

    await this.prisma.customerRefreshToken.updateMany({
      where: { tokenHash, revokedAt: null },
      data: { revokedAt: new Date() },
    });

    return { message: 'Logged out' };
  }

  private async issueTokensForCustomer(id: string, name: string, email: string) {
    const accessToken = await this.jwtService.signAsync({
      sub: id,
      type: 'CUSTOMER' as const,
    });

    const refreshToken = await this.jwtService.signAsync(
      { sub: id, type: 'CUSTOMER' as const },
      {
        secret: process.env.JWT_REFRESH_SECRET,
        expiresIn: (process.env.JWT_REFRESH_EXPIRES_IN ?? '7d') as ExpiresIn,
      },
    );

    const tokenHash = this.hashToken(refreshToken);
    const expiresAt = this.parseExpiryToDate(process.env.JWT_REFRESH_EXPIRES_IN ?? '7d');

    await this.prisma.customerRefreshToken.create({
      data: {
        customerId: id,
        tokenHash,
        expiresAt,
      },
    });

    return {
      accessToken,
      refreshToken,
      customer: { id, name, email },
    };
  }

  private hashToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  private parseExpiryToDate(expiresIn: string): Date {
    const match = expiresIn.match(/^(\d+)([smhd])$/);

    if (!match) {
      return new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    }

    const value = parseInt(match[1], 10);
    const unit = match[2] as 's' | 'm' | 'h' | 'd';

    const msPerUnit = {
      s: 1000,
      m: 60000,
      h: 3600000,
      d: 86400000,
    };

    return new Date(Date.now() + value * msPerUnit[unit]);
  }

    async loginAdmin(dto: LoginDto) {
    const admin = await this.prisma.admin.findUnique({
      where: { email: dto.email },
    });

    if (!admin || !admin.isActive) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const passwordMatches = await bcrypt.compare(dto.password, admin.password);

    if (!passwordMatches) {
      throw new UnauthorizedException('Invalid credentials');
    }

    return this.issueTokensForAdmin(admin.id, admin.name, admin.email, admin.role);
  }

  async refreshAdminTokens(refreshToken: string) {
    let payload: { sub: string; type: string };

    try {
      payload = await this.jwtService.verifyAsync(refreshToken, {
        secret: process.env.JWT_REFRESH_SECRET,
      });
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }

    const tokenHash = this.hashToken(refreshToken);

    const stored = await this.prisma.adminRefreshToken.findFirst({
      where: {
        adminId: payload.sub,
        tokenHash,
        revokedAt: null,
        expiresAt: { gt: new Date() },
      },
    });

    if (!stored) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    await this.prisma.adminRefreshToken.update({
      where: { id: stored.id },
      data: { revokedAt: new Date() },
    });

    const admin = await this.prisma.admin.findUnique({
      where: { id: payload.sub },
    });

    if (!admin || !admin.isActive) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    return this.issueTokensForAdmin(admin.id, admin.name, admin.email, admin.role);
  }

  async logoutAdmin(refreshToken: string) {
    const tokenHash = this.hashToken(refreshToken);

    await this.prisma.adminRefreshToken.updateMany({
      where: { tokenHash, revokedAt: null },
      data: { revokedAt: new Date() },
    });

    return { message: 'Logged out' };
  }

  private async issueTokensForAdmin(id: string, name: string, email: string, role: string) {
    const accessToken = await this.jwtService.signAsync({
      sub: id,
      type: 'ADMIN' as const,
      role,
    });

    const refreshToken = await this.jwtService.signAsync(
      { sub: id, type: 'ADMIN' as const, role },
      {
        secret: process.env.JWT_REFRESH_SECRET,
        expiresIn: (process.env.JWT_REFRESH_EXPIRES_IN ?? '7d') as ExpiresIn,
      },
    );

    const tokenHash = this.hashToken(refreshToken);
    const expiresAt = this.parseExpiryToDate(process.env.JWT_REFRESH_EXPIRES_IN ?? '7d');

    await this.prisma.adminRefreshToken.create({
      data: {
        adminId: id,
        tokenHash,
        expiresAt,
      },
    });

    return {
      accessToken,
      refreshToken,
      admin: { id, name, email, role },
    };
  }

    async createEmployee(dto: CreateEmployeeDto) {
    const existing = await this.prisma.admin.findUnique({
      where: { email: dto.email },
    });

    if (existing) {
      throw new ConflictException('Email already registered');
    }

    const hashedPassword = await bcrypt.hash(dto.password, 10);

    const admin = await this.prisma.admin.create({
      data: {
        name: dto.name,
        email: dto.email,
        password: hashedPassword,
        role: dto.role,
      },
    });

    const { password, ...result } = admin;
    return result;
  }

    async listAdmins() {
    const admins = await this.prisma.admin.findMany({
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        isActive: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    return admins;
  }

    async deleteAdmin(targetId: string, currentUserId: string) {
    if (targetId === currentUserId) {
      throw new ForbiddenException('You cannot delete your own account');
    }

    const target = await this.prisma.admin.findUnique({ where: { id: targetId } });

    if (!target) {
      throw new NotFoundException('Admin not found');
    }

    await this.prisma.admin.delete({ where: { id: targetId } });

    return { message: 'Admin deleted' };
  }

}