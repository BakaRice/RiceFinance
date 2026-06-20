import { IsEmail, MinLength, IsOptional, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class RegisterRequest {
  @ApiProperty() @IsEmail() email: string;
  @ApiProperty() @MinLength(8) password: string;
  @ApiProperty({ required: false }) @IsOptional() @IsString() displayName?: string;
  @ApiProperty({ required: false }) @IsOptional() @IsString() baseCurrency?: string;
}

export class LoginRequest {
  @ApiProperty() @IsEmail() email: string;
  @ApiProperty() @IsString() password: string;
}

export class RefreshRequest {
  @ApiProperty() @IsString() refreshToken: string;
}

export class LogoutRequest {
  @ApiProperty() @IsString() refreshToken: string;
}

export class UserDto {
  @ApiProperty() id: string;
  @ApiProperty() email: string;
  @ApiProperty() displayName?: string;
  @ApiProperty() baseCurrency: string;
  @ApiProperty() createdAt: string;
}

export class AuthResponse {
  @ApiProperty() accessToken: string;
  @ApiProperty() refreshToken: string;
  @ApiProperty() user: UserDto;
}
