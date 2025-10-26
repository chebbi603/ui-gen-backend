import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './modules/app/app.module';

import { CanonicalErrorFilter } from './common/filters/canonical-error.filter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService);
  app.enableCors();
  app.useGlobalFilters(new CanonicalErrorFilter());

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
  await app.listen(configService.get<string>('server.port') || 8081);
}
bootstrap();
