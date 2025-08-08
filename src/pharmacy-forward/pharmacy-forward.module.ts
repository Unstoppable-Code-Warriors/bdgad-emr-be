import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { PharmacyForwardController } from './pharmacy-forward.controller';
import { PharmacyForwardService } from './pharmacy-forward.service';

@Module({
  imports: [
    ClientsModule.registerAsync([
      {
        name: 'PHARMACY_BE_SERVICE',
        useFactory: (configService: ConfigService) => {
          const rabbitmqUrl = configService.get<string>('RABBITMQ_URL');
          if (!rabbitmqUrl) {
            throw new Error('RABBITMQ_URL is not configured');
          }
          return {
            transport: Transport.RMQ,
            options: {
              urls: [rabbitmqUrl],
              queue: 'pharmacy_be',
              queueOptions: {
                durable: false,
              },
            },
          };
        },
        inject: [ConfigService],
      },
      {
        name: 'PHARMACY_DW_SERVICE',
        useFactory: (configService: ConfigService) => {
          const rabbitmqUrl = configService.get<string>('RABBITMQ_URL');
          if (!rabbitmqUrl) {
            throw new Error('RABBITMQ_URL is not configured');
          }
          return {
            transport: Transport.RMQ,
            options: {
              urls: [rabbitmqUrl],
              queue: 'pharmacy_dw',
              queueOptions: {
                durable: false,
              },
            },
          };
        },
        inject: [ConfigService],
      },
    ]),
  ],
  controllers: [PharmacyForwardController],
  providers: [PharmacyForwardService],
})
export class PharmacyForwardModule {}
