import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as argon2 from 'argon2';
import * as bcrypt from 'bcryptjs';
import { randomBytes, createHash } from 'crypto';
import { PrismaService } from '../common/prisma.service';
import { AppError, ErrorCode } from '../common/error.codes';
import { RegisterRequest, LoginRequest, AuthResponse, UserDto } from './auth.dto';

@Injectable()
export class AuthService {
  private static readonly PRIVATE_REGISTRATION_EMAIL_PREFIX = 'ricemarch';

  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
  ) {}

  async register(req: RegisterRequest): Promise<AuthResponse> {
    if (!this.canRegisterEmail(req.email)) {
      throw new AppError(ErrorCode.FORBIDDEN, 'Registration is not available for this account');
    }

    const existing = await this.prisma.user.findUnique({ where: { email: req.email } });
    if (existing) throw new AppError(ErrorCode.CONFLICT, 'Email already registered');

    const passwordHash = await argon2.hash(req.password);
    const user = await this.prisma.user.create({
      data: {
        email: req.email,
        passwordHash,
        displayName: req.displayName || null,
        baseCurrency: req.baseCurrency || 'CNY',
      },
    });

    return this.generateAuthResponse(user);
  }

  private canRegisterEmail(email: string): boolean {
    return email.trim().toLowerCase().startsWith(AuthService.PRIVATE_REGISTRATION_EMAIL_PREFIX);
  }

  async login(req: LoginRequest): Promise<AuthResponse> {
    const user = await this.prisma.user.findUnique({ where: { email: req.email } });
    if (!user) throw new AppError(ErrorCode.UNAUTHORIZED, 'Invalid email or password');

    const valid = await this.verifyPassword(user.passwordHash, req.password);
    if (!valid) throw new AppError(ErrorCode.UNAUTHORIZED, 'Invalid email or password');

    // Re-hash legacy BCrypt passwords with Argon2
    if (this.isBcryptHash(user.passwordHash)) {
      const newHash = await argon2.hash(req.password);
      await this.prisma.user.update({
        where: { id: user.id },
        data: { passwordHash: newHash },
      });
    }

    return this.generateAuthResponse(user);
  }

  private async verifyPassword(hash: string, password: string): Promise<boolean> {
    if (this.isBcryptHash(hash)) {
      return bcrypt.compare(password, hash);
    }
    return argon2.verify(hash, password);
  }

  private isBcryptHash(hash: string): boolean {
    return hash.startsWith('$2a$') || hash.startsWith('$2b$') || hash.startsWith('$2y$');
  }

  async refresh(req: { refreshToken: string }): Promise<AuthResponse> {
    const tokenHash = this.hashToken(req.refreshToken);
    const stored = await this.prisma.refreshToken.findUnique({ where: { tokenHash } });

    if (!stored || stored.revokedAt || stored.expiresAt < new Date()) {
      if (stored && !stored.revokedAt) {
        await this.prisma.refreshToken.update({
          where: { id: stored.id },
          data: { revokedAt: new Date() },
        });
      }
      throw new AppError(ErrorCode.UNAUTHORIZED, 'Invalid or expired refresh token');
    }

    // Rotate: revoke old token
    await this.prisma.refreshToken.update({
      where: { id: stored.id },
      data: { revokedAt: new Date() },
    });

    const user = await this.prisma.user.findUnique({ where: { id: stored.userId } });
    if (!user) throw new AppError(ErrorCode.UNAUTHORIZED, 'User not found');

    return this.generateAuthResponse(user);
  }

  async logout(userId: string, req: { refreshToken: string }): Promise<void> {
    const tokenHash = this.hashToken(req.refreshToken);
    await this.prisma.refreshToken.updateMany({
      where: { tokenHash, userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  private async generateAuthResponse(user: any): Promise<AuthResponse> {
    const payload = { sub: user.id, email: user.email };
    const accessToken = this.jwtService.sign(payload);

    const refreshToken = randomBytes(48).toString('base64url');
    const tokenHash = this.hashToken(refreshToken);
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    await this.prisma.refreshToken.create({
      data: { userId: user.id, tokenHash, expiresAt },
    });

    const userDto: UserDto = {
      id: user.id,
      email: user.email,
      displayName: user.displayName || undefined,
      baseCurrency: user.baseCurrency,
      createdAt: user.createdAt.toISOString(),
    };

    return { accessToken, refreshToken, user: userDto };
  }

  private hashToken(token: string): string {
    return createHash('sha256').update(token).digest('base64');
  }
}
