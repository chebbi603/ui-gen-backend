import { Body, Controller, Post, Request, UseGuards } from '@nestjs/common';
import { AuthService } from '../services/auth.service';
import { LocalAuthGuard } from '../guards/local-auth.guard';
import { ApiBody, ApiResponse, ApiTags } from '@nestjs/swagger';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @UseGuards(LocalAuthGuard)
  @Post('/login')
  @ApiBody({
    schema: {
      properties: { email: { type: 'string' }, password: { type: 'string' } },
      required: ['email', 'password'],
    },
  })
  @ApiResponse({ status: 201, description: 'Login success with JWT.' })
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
        password: { type: 'string' },
      },
      required: ['email', 'password'],
    },
  })
  @ApiResponse({ status: 201, description: 'User registered.' })
  async register(@Body() body: any) {
    await this.authService.signUp(body);
    return { ok: true };
  }
}
