import { registerAs } from '@nestjs/config';
import * as crypto from 'crypto';

function generateDevSecret(): string {
  // 512-bit hex secret for strong dev default
  return crypto.randomBytes(64).toString('hex');
}

export default registerAs('auth', (): Record<string, any> => {
  const isProd = (process.env.NODE_ENV || 'development') === 'production';
  const envSecret = process.env.JWT_SECRET;
  const secret = envSecret && envSecret.length >= 32 ? envSecret : (isProd ? undefined : generateDevSecret());
  const envRefreshSecret = process.env.JWT_REFRESH_SECRET;
  const refreshSecret = envRefreshSecret && envRefreshSecret.length >= 32 ? envRefreshSecret : (isProd ? undefined : generateDevSecret());

  return {
    jwt: {
      secret,
      // default expiry; can be overridden via env if desired
      expiresIn: process.env.JWT_EXPIRES_IN || '1h',
      refreshSecret,
      refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
    },
  };
});