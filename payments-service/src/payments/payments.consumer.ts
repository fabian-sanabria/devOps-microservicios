import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as amqp from 'amqplib';
import { PaymentsService } from './payments.service';
import { PaymentStatus } from './entities/payment.entity';

interface PaymentRequest {
  orderId: string;
  amount: number;
  idempotencyKey: string;
}

@Injectable()
export class PaymentsConsumer implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PaymentsConsumer.name);
  private connection: any;
  private channel: amqp.Channel;
  private readonly rabbitmqUrl: string;

  constructor(
    private readonly paymentsService: PaymentsService,
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

        const requestQueue = 'payment.requests';
        const resultQueue = 'payment.results';

        await this.channel.assertQueue(requestQueue, { durable: true });
        await this.channel.assertQueue(resultQueue, { durable: true });
        this.channel.prefetch(1);

        this.channel.consume(requestQueue, async (msg) => {
          if (!msg) return;
          try {
            const request: PaymentRequest = JSON.parse(msg.content.toString());
            await this.handlePaymentRequest(request);
            this.channel.ack(msg);
          } catch (err) {
            this.logger.error('Error processing payment request', err);
            this.channel.nack(msg, false, false);
          }
        });

        this.logger.log(
          'Connected to RabbitMQ — listening on payment.requests',
        );
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

  private async handlePaymentRequest(request: PaymentRequest): Promise<void> {
    const payment = await this.paymentsService.processPayment(request);

    const result = {
      orderId: request.orderId,
      paymentId: payment.id,
      status: payment.status === PaymentStatus.APPROVED ? 'approved' : 'rejected',
    };

    this.channel.sendToQueue(
      'payment.results',
      Buffer.from(JSON.stringify(result)),
      { persistent: true },
    );

    this.logger.log(
      `Payment result published for order ${request.orderId}: ${result.status}`,
    );
  }
}
