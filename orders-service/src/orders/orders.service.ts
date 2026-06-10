import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import * as amqp from 'amqplib';
import { Order, OrderStatus } from './entities/order.entity';
import { CartService } from '../cart/cart.service';

@Injectable()
export class OrdersService {
  private readonly logger = new Logger(OrdersService.name);
  private readonly catalogUrl: string;
  private readonly rabbitmqUrl: string;

  constructor(
    @InjectRepository(Order)
    private readonly ordersRepository: Repository<Order>,
    private readonly cartService: CartService,
    private readonly config: ConfigService,
  ) {
    this.catalogUrl = config.get(
      'CATALOG_SERVICE_URL',
      'http://catalog-service:3002',
    );
    this.rabbitmqUrl = config.get(
      'RABBITMQ_URL',
      'amqp://guest:guest@rabbitmq:5672',
    );
  }

  async createFromCart(buyerId: string): Promise<Order> {
    const cartItems = await this.cartService.getCart(buyerId);
    if (!cartItems.length) {
      throw new BadRequestException('Cart is empty');
    }

    const resolvedItems = await Promise.all(
      cartItems.map(async (item) => {
        const { data: product } = await axios.get(
          `${this.catalogUrl}/products/${item.productId}`,
          { timeout: 5000 },
        );
        return {
          productId: item.productId,
          productName: product.name,
          quantity: item.quantity,
          unitPrice: Number(product.price),
        };
      }),
    );

    const total = resolvedItems.reduce(
      (sum, item) => sum + item.unitPrice * item.quantity,
      0,
    );

    await Promise.all(
      resolvedItems.map((item) =>
        axios.patch(
          `${this.catalogUrl}/products/${item.productId}/stock`,
          { quantity: item.quantity },
          { timeout: 5000 },
        ),
      ),
    );

    const order = this.ordersRepository.create({
      buyerId,
      items: resolvedItems,
      total,
      status: OrderStatus.CONFIRMED,
    });
    const saved = await this.ordersRepository.save(order);

    await this.cartService.clearCart(buyerId);

    await this.publishPaymentRequest(saved).catch((err) =>
      this.logger.error('Failed to publish payment request', err.message),
    );

    return saved;
  }

  async findAll(buyerId: string): Promise<Order[]> {
    return this.ordersRepository.find({
      where: { buyerId },
      order: { createdAt: 'DESC' },
    });
  }

  async findOne(id: string, buyerId: string): Promise<Order> {
    const order = await this.ordersRepository.findOne({
      where: { id, buyerId },
    });
    if (!order) throw new NotFoundException(`Order ${id} not found`);
    return order;
  }

  async updateStatus(
    orderId: string,
    status: OrderStatus,
    paymentId?: string,
  ): Promise<void> {
    const order = await this.ordersRepository.findOne({ where: { id: orderId } });
    if (!order) return;
    order.status = status;
    if (paymentId) order.paymentId = paymentId;
    await this.ordersRepository.save(order);
    this.logger.log(`Order ${orderId} status updated to ${status}`);
  }

  private async publishPaymentRequest(order: Order): Promise<void> {
    const conn = await amqp.connect(this.rabbitmqUrl);
    const channel = await conn.createChannel();
    const queue = 'payment.requests';
    await channel.assertQueue(queue, { durable: true });

    const message = {
      orderId: order.id,
      amount: Number(order.total),
      idempotencyKey: `order-${order.id}`,
    };

    channel.sendToQueue(queue, Buffer.from(JSON.stringify(message)), {
      persistent: true,
    });

    await channel.close();
    await conn.close();
    this.logger.log(`Payment request published for order ${order.id}`);
  }
}
