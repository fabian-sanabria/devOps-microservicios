import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OrdersModule } from './orders/orders.module';
import { CartModule } from './cart/cart.module';
import { HealthModule } from './health/health.module';
import { AuthModule } from './auth/auth.module';
import { Order } from './orders/entities/order.entity';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'postgres',
        host: config.get('ORDERS_DB_HOST', 'db-orders'),
        port: config.get<number>('ORDERS_DB_PORT', 5432),
        database: config.get('ORDERS_DB_NAME', 'orders'),
        username: config.get('ORDERS_DB_USER', 'orders_user'),
        password: config.get('ORDERS_DB_PASSWORD', 'changeme'),
        entities: [Order],
        synchronize: config.get('NODE_ENV') !== 'production',
        retryAttempts: 5,
        retryDelay: 3000,
      }),
    }),
    AuthModule,
    CartModule,
    OrdersModule,
    HealthModule,
  ],
})
export class AppModule {}
