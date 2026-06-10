import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { HealthModule } from './health/health.module';
import { User } from './users/entities/user.entity';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'postgres',
        host: config.get('AUTH_DB_HOST', 'db-auth'),
        port: config.get<number>('AUTH_DB_PORT', 5432),
        database: config.get('AUTH_DB_NAME', 'auth'),
        username: config.get('AUTH_DB_USER', 'auth_user'),
        password: config.get('AUTH_DB_PASSWORD', 'changeme'),
        entities: [User],
        synchronize: config.get('NODE_ENV') !== 'production',
        retryAttempts: 5,
        retryDelay: 3000,
      }),
    }),
    AuthModule,
    UsersModule,
    HealthModule,
  ],
})
export class AppModule {}
