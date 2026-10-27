import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { configureApp } from './app.setup';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  configureApp(app);

  // Swagger : UI sur /api/docs, spec JSON sur /api/docs-json
  const swaggerConfig = new DocumentBuilder()
    .setTitle('Brume API')
    .setDescription('API e-commerce Brume : thé, café et CBD')
    .setVersion('1.0.0')
    .addCookieAuth(
      'brume_session',
      { type: 'apiKey', in: 'cookie' },
      'sessionCookie',
    )
    .build();
  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api/docs', app, document, {
    jsonDocumentUrl: 'api/docs-json',
    swaggerOptions: { persistAuthorization: true },
  });

  await app.listen(process.env.PORT ?? 3000);
}
void bootstrap();
