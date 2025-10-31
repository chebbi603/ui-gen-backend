import { ConfigService } from '@nestjs/config';
import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

import { CanonicalErrorFilter } from './common/filters/canonical-error.filter';
import IORedis from 'ioredis';

async function bootstrap() {
  // Shim Buffer.SlowBuffer for older libs expecting it (e.g., buffer-equal-constant-time)
  // without changing node modules or Node version.
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const bufferModule = require('buffer');
    if (!bufferModule.SlowBuffer) {
      bufferModule.SlowBuffer = bufferModule.Buffer;
    }
  } catch (e) {
    // eslint-disable-next-line no-console
    console.warn('Buffer shim failed to apply:', (e as any)?.message || e);
  }

  const { AppModule } = await import('./modules/app/app.module');
  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService);
  app.enableCors();
  app.useGlobalFilters(new CanonicalErrorFilter());
  app.useGlobalPipes(new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
  }));

  const swaggerConfig = new DocumentBuilder()
    .setTitle('UI Customisation Api')
    .setDescription('The UI Customisation API description')
    .setVersion('1.0')
    .addTag("API's")
    .addBearerAuth(
      { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
      'accessToken',
    )
    .addBearerAuth(
      { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
      'refreshToken',
    )
    .build();
  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api', app, document);
  // Redis health check (PING) before starting the server
  try {
    const redisUrl = configService.get<string>('redis.url');
    const host = configService.get<string>('redis.host');
    const port = configService.get<number>('redis.port');
    const password = configService.get<string>('redis.password');
    const db = configService.get<number>('redis.db');
    const commonOpts = {
      lazyConnect: true,
      maxRetriesPerRequest: 1,
      enableReadyCheck: false,
      retryStrategy: () => null,
      reconnectOnError: () => false,
    } as any;
    const redis = redisUrl
      ? new IORedis(redisUrl, commonOpts)
      : new IORedis({ host, port, password, db, ...(commonOpts as any) });
    redis.on('error', (err) => {
      // eslint-disable-next-line no-console
      console.warn('[Redis] Connection error during health check:', err?.message || err);
    });
    const pong = await redis.ping();
    if (pong === 'PONG') {
      // eslint-disable-next-line no-console
      console.log('[Redis] Connection OK (PONG)');
    } else {
      // eslint-disable-next-line no-console
      console.warn('[Redis] Unexpected PING response:', pong);
    }
    await redis.quit();
  } catch (err: any) {
    // eslint-disable-next-line no-console
    console.warn('[Redis] Connection check failed:', err?.message || err);
  }
  await app.listen(configService.get<string>('server.port') || 8081);
}
bootstrap();
