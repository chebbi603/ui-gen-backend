import { Body, Controller, Post, Request, UseGuards, HttpCode, HttpStatus } from '@nestjs/common';
import { AuthService } from '../services/auth.service';
import { LocalAuthGuard } from '../guards/local-auth.guard';
import { ApiBody, ApiResponse, ApiTags } from '@nestjs/swagger';
import { CreateUserDto } from '../../user/dto/create-user.dto';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @UseGuards(LocalAuthGuard)
  @Post('/login')
  @HttpCode(HttpStatus.OK)
  @ApiBody({
    schema: {
      properties: { email: { type: 'string' }, password: { type: 'string' } },
      required: ['email', 'password'],
    },
  })
  @ApiResponse({ status: 200, description: 'Login success with JWT.' })
  async login(@Request() req) {
    return this.authService.login(req.user);
  }

  @Post('/signup')
  async signUpLegacy(@Request() req) {
    await this.authService.signUp(req.body);
    return { ok: true };
  }

  @Post('/register')
  @ApiBody({
    schema: {
      properties: {
        email: { type: 'string' },
        username: { type: 'string' },
        name: { type: 'string' },
        password: { type: 'string', minLength: 6 },
      },
      required: ['email', 'username', 'password'],
    },
  })
  @ApiResponse({ status: 201, description: 'User registered.' })
  async register(@Body() body: CreateUserDto) {
    await this.authService.signUp(body);
    return { ok: true };
  }

  @Post('/refresh')
  @ApiBody({
    schema: {
      properties: { refreshToken: { type: 'string' } },
      required: ['refreshToken'],
    },
  })
  @ApiResponse({ status: 201, description: 'Refresh tokens issued.' })
  async refresh(@Body('refreshToken') refreshToken: string) {
    return this.authService.refreshTokens(refreshToken);
  }

  @Post('/logout')
  @ApiBody({
    schema: {
      properties: { refreshToken: { type: 'string' } },
      required: ['refreshToken'],
    },
  })
  @ApiResponse({ status: 201, description: 'Logged out.' })
  async logout(@Body('refreshToken') refreshToken: string) {
    return this.authService.logout(refreshToken);
  }
}
