import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as amqp from 'amqplib';
import { OrdersService } from './orders.service';
import { OrderStatus } from './entities/order.entity';

interface PaymentResult {
  orderId: string;
  paymentId: string;
  status: 'approved' | 'rejected';
}

@Injectable()
export class OrdersConsumer implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(OrdersConsumer.name);
  private connection: amqp.AmqpConnectionManager | any;
  private channel: amqp.Channel;
  private readonly rabbitmqUrl: string;

  constructor(
    private readonly ordersService: OrdersService,
    private readonly config: ConfigService,
  ) {
    this.rabbitmqUrl = config.get(
      'RABBITMQ_URL',
      'amqp://guest:guest@rabbitmq:5672',
    );
  }

  async onModuleInit() {
    await this.connect();
  }

  async onModuleDestroy() {
    try {
      await this.channel?.close();
      await this.connection?.close();
    } catch (_) {}
  }

  private async connect(retries = 5, delay = 3000): Promise<void> {
    for (let i = 1; i <= retries; i++) {
      try {
        this.connection = await amqp.connect(this.rabbitmqUrl);
        this.channel = await this.connection.createChannel();

        const queue = 'payment.results';
        await this.channel.assertQueue(queue, { durable: true });
        this.channel.prefetch(1);

        this.channel.consume(queue, async (msg) => {
          if (!msg) return;
          try {
            const result: PaymentResult = JSON.parse(msg.content.toString());
            await this.handlePaymentResult(result);
            this.channel.ack(msg);
          } catch (err) {
            this.logger.error('Error processing payment result', err);
            this.channel.nack(msg, false, false);
          }
        });

        this.logger.log('Connected to RabbitMQ — listening on payment.results');
        return;
      } catch (err) {
        this.logger.warn(
          `RabbitMQ connect attempt ${i}/${retries} failed: ${err.message}`,
        );
        if (i < retries) await new Promise((r) => setTimeout(r, delay));
      }
    }
    this.logger.error('Could not connect to RabbitMQ after all retries');
  }

  private async handlePaymentResult(result: PaymentResult) {
    const status =
      result.status === 'approved' ? OrderStatus.PAID : OrderStatus.FAILED;
    await this.ordersService.updateStatus(result.orderId, status, result.paymentId);
    this.logger.log(
      `Payment ${result.status} for order ${result.orderId}`,
    );
  }
}
