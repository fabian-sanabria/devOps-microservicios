import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Payment, PaymentStatus } from './entities/payment.entity';

export interface ProcessPaymentDto {
  orderId: string;
  amount: number;
  idempotencyKey: string;
}

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);

  constructor(
    @InjectRepository(Payment)
    private readonly paymentsRepository: Repository<Payment>,
  ) {}

  async processPayment(dto: ProcessPaymentDto): Promise<Payment> {
    const existing = await this.paymentsRepository.findOne({
      where: { idempotencyKey: dto.idempotencyKey },
    });

    if (existing) {
      this.logger.log(
        `Idempotent payment found for key ${dto.idempotencyKey} — returning existing`,
      );
      return existing;
    }

    const status = this.simulatePayment(dto.amount);

    const payment = this.paymentsRepository.create({
      orderId: dto.orderId,
      amount: dto.amount,
      status,
      idempotencyKey: dto.idempotencyKey,
    });

    const saved = await this.paymentsRepository.save(payment);
    this.logger.log(
      `Payment ${saved.id} for order ${dto.orderId}: ${status}`,
    );
    return saved;
  }

  async findByOrder(orderId: string): Promise<Payment | null> {
    return this.paymentsRepository.findOne({ where: { orderId } });
  }

  private simulatePayment(amount: number): PaymentStatus {
    if (amount <= 0) return PaymentStatus.REJECTED;
    return Math.random() < 0.9 ? PaymentStatus.APPROVED : PaymentStatus.REJECTED;
  }
}
