import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { Transport, MicroserviceOptions } from '@nestjs/microservices';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.setGlobalPrefix('api/v1');
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
  const rabbitmqUrl = configService.get<string>('RABBITMQ_URL');

  // Setup microservice to listen to pharmacy queue (safer approach)
  if (rabbitmqUrl) {
    try {
      const microservice = app.connectMicroservice<MicroserviceOptions>({
        transport: Transport.RMQ,
        options: {
          urls: [rabbitmqUrl],
          queue: 'pharmacy',
          queueOptions: {
            durable: false,
          },
        },
      });

      await app.startAllMicroservices();
      console.log('Microservice is listening to pharmacy queue');
    } catch (error) {
      console.error('Failed to start microservice:', error.message);
      console.log('Continuing with HTTP server only...');
    }
  } else {
    console.warn('RABBITMQ_URL not configured, microservice not started');
  }

  await app.listen(port);
  console.log(`Application is running on: http://localhost:${port}`);
}
bootstrap();
