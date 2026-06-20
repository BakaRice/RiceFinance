import { Injectable } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { UserDto } from '../auth/auth.dto';
import { AppError, ErrorCode } from '../common/error.codes';

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  async getMe(userId: string): Promise<UserDto> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new AppError(ErrorCode.NOT_FOUND, 'User not found');
    return {
      id: user.id,
      email: user.email,
      displayName: user.displayName || undefined,
      baseCurrency: user.baseCurrency,
      createdAt: user.createdAt.toISOString(),
    };
  }
}
