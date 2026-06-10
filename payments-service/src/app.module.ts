import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PaymentsModule } from './payments/payments.module';
import { HealthModule } from './health/health.module';
import { Payment } from './payments/entities/payment.entity';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'postgres',
        host: config.get('PAYMENTS_DB_HOST', 'db-payments'),
        port: config.get<number>('PAYMENTS_DB_PORT', 5432),
        database: config.get('PAYMENTS_DB_NAME', 'payments'),
        username: config.get('PAYMENTS_DB_USER', 'payments_user'),
        password: config.get('PAYMENTS_DB_PASSWORD', 'changeme'),
        entities: [Payment],
        synchronize: config.get('NODE_ENV') !== 'production',
        retryAttempts: 5,
        retryDelay: 3000,
      }),
    }),
    PaymentsModule,
    HealthModule,
  ],
})
export class AppModule {}
