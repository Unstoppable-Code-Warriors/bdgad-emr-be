import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { Transport, MicroserviceOptions } from '@nestjs/microservices';
import { AppModule } from './app.module';

async function bootstrap() {
  try {
    const app = await NestFactory.create(AppModule);
    app.setGlobalPrefix('api/v1');
    app.enableCors({
      origin: [
        /^http:\/\/localhost(:\d+)?$/,
        /^https?:\/\/.*\.bdgad\.bio$/,
        /^https?:\/\/bdgad\.bio$/,
      ],
      methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
      allowedHeaders: [
        'Content-Type',
        'Authorization',
        'Accept',
        'Accept-Language',
        'Cache-Control',
        'Connection',
        'Host',
        'Origin',
        'Referer',
        'User-Agent',
        // OpenAI SDK and similar libraries headers
        'x-stainless-os',
        'x-stainless-arch',
        'x-stainless-package-version',
        'x-stainless-runtime',
        'x-stainless-runtime-version',
        'x-stainless-lang',
        'x-stainless-retry-count',
        // Additional common headers
        'x-requested-with',
        'x-api-key',
        'x-client-version',
      ],
      credentials: true,
      preflightContinue: false,
      optionsSuccessStatus: 204,
    });

    const configService = app.get(ConfigService);
    const port = configService.get<number>('PORT', 4000);
    const rabbitmqUrl = configService.get<string>('RABBITMQ_URL');

    // Setup microservice to listen to pharmacy queue (safer approach)
    if (rabbitmqUrl) {
      try {
        app.connectMicroservice<MicroserviceOptions>({
          transport: Transport.RMQ,
          options: {
            urls: [rabbitmqUrl],
            queue: 'pharmacy',
            queueOptions: {
              durable: false,
            },
          },
        });

        app.connectMicroservice<MicroserviceOptions>({
          transport: Transport.RMQ,
          options: {
            urls: [rabbitmqUrl],
            queue: 'general_file',
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
  } catch (error) {
    console.error('Failed to start application:', error.message);
    process.exit(1);
  }
}
bootstrap();
