import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProductsModule } from './products/products.module';
import { HealthModule } from './health/health.module';
import { AuthModule } from './auth/auth.module';
import { Product } from './products/entities/product.entity';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'postgres',
        host: config.get('CATALOG_DB_HOST', 'db-catalog'),
        port: config.get<number>('CATALOG_DB_PORT', 5432),
        database: config.get('CATALOG_DB_NAME', 'catalog'),
        username: config.get('CATALOG_DB_USER', 'catalog_user'),
        password: config.get('CATALOG_DB_PASSWORD', 'changeme'),
        entities: [Product],
        synchronize: config.get('NODE_ENV') !== 'production',
        retryAttempts: 5,
        retryDelay: 3000,
      }),
    }),
    AuthModule,
    ProductsModule,
    HealthModule,
  ],
})
export class AppModule {}
