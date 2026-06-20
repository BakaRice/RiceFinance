import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../common/prisma.service';
import { AppError, ErrorCode } from '../common/error.codes';
import { AuthService } from './auth.service';

jest.mock('argon2', () => ({
  hash: jest.fn().mockResolvedValue('hashed-password'),
  verify: jest.fn(),
}));

describe('AuthService', () => {
  const createPrisma = () => ({
    user: {
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    refreshToken: {
      create: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
  });

  const createService = () => {
    const prisma = createPrisma();
    const jwtService = { sign: jest.fn().mockReturnValue('access-token') };

    return {
      prisma,
      service: new AuthService(
        prisma as unknown as PrismaService,
        jwtService as unknown as JwtService,
      ),
    };
  };

  it('rejects registration for email addresses outside the private prefix without revealing the prefix', async () => {
    const { prisma, service } = createService();
    const now = new Date('2026-06-20T00:00:00.000Z');

    prisma.user.findUnique.mockResolvedValue(null);
    prisma.user.create.mockResolvedValue({
      id: 'user-id',
      email: 'user@example.com',
      displayName: null,
      baseCurrency: 'CNY',
      createdAt: now,
    });

    await expect(
      service.register({
        email: 'user@example.com',
        password: 'password123',
      }),
    ).rejects.toMatchObject({
      code: ErrorCode.FORBIDDEN,
      message: 'Registration is not available for this account',
    });

    await expect(
      service.register({
        email: 'user@example.com',
        password: 'password123',
      }),
    ).rejects.not.toThrow(/ricemarch/i);
    expect(prisma.user.create).not.toHaveBeenCalled();
  });

  it('allows registration for email addresses that start with the private prefix', async () => {
    const { prisma, service } = createService();
    const now = new Date('2026-06-20T00:00:00.000Z');

    prisma.user.findUnique.mockResolvedValue(null);
    prisma.user.create.mockResolvedValue({
      id: 'user-id',
      email: 'ricemarch@example.com',
      displayName: null,
      baseCurrency: 'CNY',
      createdAt: now,
    });

    const result = await service.register({
      email: 'ricemarch@example.com',
      password: 'password123',
    });

    expect(prisma.user.create).toHaveBeenCalledWith({
      data: {
        email: 'ricemarch@example.com',
        passwordHash: 'hashed-password',
        displayName: null,
        baseCurrency: 'CNY',
      },
    });
    expect(result.user.email).toBe('ricemarch@example.com');
  });
});
