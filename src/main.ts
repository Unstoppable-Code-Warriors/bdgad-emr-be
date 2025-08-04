import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.setGlobalPrefix('api/v1');
  // cors
  app.enableCors({
    origin: [
      /^http:\/\/localhost(:\d+)?$/,
      /^https?:\/\/.*\.bdgad\.bio$/,
      /^https?:\/\/bdgad\.bio$/,
    ],
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
    allowedHeaders: 'Content-Type, Authorization',
  });
  const configService = app.get(ConfigService);
  const port = configService.get<number>('PORT', 4000);

  await app.listen(port);
  console.log(`Application is running on: http://localhost:${port}`);
}
bootstrap();
