import { Injectable, UnauthorizedException } from '@nestjs/common';
import { UserService } from '../../user/services/user.service';
import { JwtService } from '@nestjs/jwt';
import { CreateUserDto } from '../../user/dto/create-user.dto';
import * as bcrypt from 'bcrypt';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class AuthService {
  constructor(
    private userService: UserService,
    private jwtService: JwtService,
    private configService: ConfigService,
  ) {}

  async validateUser(email: string, pass: string): Promise<any> {
    const user = await this.userService.findByEmail(email);
    if (user) {
      const passwordIsValid = await bcrypt.compare(pass, (user as any).passwordHash);
      if (passwordIsValid) {
        delete (user as any).passwordHash;
        return user;
      }
    }
    return null;
  }

  async login(user: any) {
    const payload = { email: user.email, sub: user._id, role: user.role };

    const accessToken = this.jwtService.sign(payload);

    const refreshSecret = this.configService.get<string>('auth.jwt.refreshSecret');
    const refreshExpiresIn = this.configService.get<string>('auth.jwt.refreshExpiresIn');
    if (!refreshSecret) {
      throw new UnauthorizedException('Refresh secret not configured');
    }
    const refreshToken = this.jwtService.sign(payload, {
      secret: refreshSecret,
      expiresIn: refreshExpiresIn,
    });

    const salt = await bcrypt.genSalt(10);
    const refreshTokenHash = await bcrypt.hash(refreshToken, salt);
    await this.userService.addRefreshToken(user._id.toString(), refreshTokenHash);

    return {
      _id: user.id,
      role: payload.role,
      accessToken,
      refreshToken,
    };
  }

  async signUp(user: CreateUserDto) {
    await this.userService.create(user);
  }

  async refreshTokens(refreshToken: string) {
    const refreshSecret = this.configService.get<string>('auth.jwt.refreshSecret');
    if (!refreshSecret) {
      throw new UnauthorizedException('Refresh secret not configured');
    }
    let payload: any;
    try {
      payload = this.jwtService.verify(refreshToken, {
        secret: refreshSecret,
      });
    } catch (e) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    const userId = payload.sub?.toString();
    const user = await this.userService.findOne(userId);
    if (!user) throw new UnauthorizedException('User not found');

    // find matching hashed refresh token
    let matchedHash: string | null = null;
    for (const hash of (user as any).refreshTokens || []) {
      const ok = await bcrypt.compare(refreshToken, hash);
      if (ok) {
        matchedHash = hash;
        break;
      }
    }
    if (!matchedHash) {
      throw new UnauthorizedException('Refresh token not recognized');
    }

    const newAccessToken = this.jwtService.sign({
      email: user.email,
      sub: user._id,
      role: user.role,
    });
    const refreshExpiresIn = this.configService.get<string>('auth.jwt.refreshExpiresIn');
    const newRefreshToken = this.jwtService.sign({
      email: user.email,
      sub: user._id,
      role: user.role,
    }, {
      secret: refreshSecret,
      expiresIn: refreshExpiresIn,
    });
    const salt = await bcrypt.genSalt(10);
    const newRefreshTokenHash = await bcrypt.hash(newRefreshToken, salt);
    await this.userService.addRefreshToken(userId, newRefreshTokenHash);
    await this.userService.removeRefreshToken(userId, matchedHash);

    return {
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
    };
  }

  async logout(refreshToken: string) {
    const refreshSecret = this.configService.get<string>('auth.jwt.refreshSecret');
    if (!refreshSecret) {
      throw new UnauthorizedException('Refresh secret not configured');
    }
    let payload: any;
    try {
      payload = this.jwtService.verify(refreshToken, {
        secret: refreshSecret,
      });
    } catch (e) {
      throw new UnauthorizedException('Invalid refresh token');
    }
    const userId = payload.sub?.toString();
    const user = await this.userService.findOne(userId);
    if (!user) throw new UnauthorizedException('User not found');
    // find matching hashed refresh token
    let matchedHash: string | null = null;
    for (const hash of (user as any).refreshTokens || []) {
      const ok = await bcrypt.compare(refreshToken, hash);
      if (ok) {
        matchedHash = hash;
        break;
      }
    }
    if (matchedHash) {
      await this.userService.removeRefreshToken(userId, matchedHash);
    }
    return { ok: true };
  }
}
