import { registerAs } from '@nestjs/config';

export default registerAs('redis', (): Record<string, any> => {
  const isProd = (process.env.NODE_ENV || 'development') === 'production';
  return {
    url: process.env.REDIS_URL,
    host: process.env.REDIS_HOST || (isProd ? undefined : '127.0.0.1'),
    port: process.env.REDIS_PORT ? Number(process.env.REDIS_PORT) : (isProd ? undefined : 6379),
    password: process.env.REDIS_PASSWORD,
    db: process.env.REDIS_DB ? Number(process.env.REDIS_DB) : 0,
  };
});