import { Controller, Post, Body, UseGuards, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { RegisterRequest, LoginRequest, RefreshRequest, LogoutRequest, AuthResponse } from './auth.dto';
import { JwtAuthGuard } from './auth.guard';
import { CurrentUser } from './current-user.decorator';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post('register')
  async register(@Body() req: RegisterRequest): Promise<AuthResponse> {
    return this.authService.register(req);
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(@Body() req: LoginRequest): Promise<AuthResponse> {
    return this.authService.login(req);
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(@Body() req: RefreshRequest): Promise<AuthResponse> {
    return this.authService.refresh(req);
  }

  @Post('logout')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  async logout(@CurrentUser() user: any, @Body() req: LogoutRequest): Promise<void> {
    return this.authService.logout(user.userId, req);
  }
}
