import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Payment } from './entities/payment.entity';
import { PaymentsService } from './payments.service';
import { PaymentsConsumer } from './payments.consumer';

@Module({
  imports: [TypeOrmModule.forFeature([Payment])],
  providers: [PaymentsService, PaymentsConsumer],
  exports: [PaymentsService],
})
export class PaymentsModule {}
