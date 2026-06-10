import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Order } from './entities/order.entity';
import { OrdersService } from './orders.service';
import { OrdersController } from './orders.controller';
import { OrdersConsumer } from './orders.consumer';
import { CartModule } from '../cart/cart.module';

@Module({
  imports: [TypeOrmModule.forFeature([Order]), CartModule],
  providers: [OrdersService, OrdersConsumer],
  controllers: [OrdersController],
})
export class OrdersModule {}
