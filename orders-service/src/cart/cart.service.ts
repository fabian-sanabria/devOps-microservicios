import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { AddToCartDto } from './dto/cart-item.dto';

export interface CartItem {
  productId: string;
  quantity: number;
}

@Injectable()
export class CartService {
  private readonly redis: Redis;
  private readonly logger = new Logger(CartService.name);
  private readonly TTL_SECONDS = 3600 * 24;

  constructor(private readonly config: ConfigService) {
    this.redis = new Redis(config.get('REDIS_URL', 'redis://redis:6379'), {
      retryStrategy: (times) => Math.min(times * 50, 2000),
      maxRetriesPerRequest: 3,
    });

    this.redis.on('error', (err) =>
      this.logger.error('Redis error', err.message),
    );
  }

  private cartKey(userId: string) {
    return `cart:${userId}`;
  }

  async getCart(userId: string): Promise<CartItem[]> {
    const raw = await this.redis.get(this.cartKey(userId));
    return raw ? JSON.parse(raw) : [];
  }

  async addItem(userId: string, dto: AddToCartDto): Promise<CartItem[]> {
    const cart = await this.getCart(userId);
    const existing = cart.find((i) => i.productId === dto.productId);

    if (existing) {
      existing.quantity += dto.quantity;
    } else {
      cart.push({ productId: dto.productId, quantity: dto.quantity });
    }

    await this.redis.setex(
      this.cartKey(userId),
      this.TTL_SECONDS,
      JSON.stringify(cart),
    );
    return cart;
  }

  async removeItem(userId: string, productId: string): Promise<CartItem[]> {
    const cart = await this.getCart(userId);
    const updated = cart.filter((i) => i.productId !== productId);
    await this.redis.setex(
      this.cartKey(userId),
      this.TTL_SECONDS,
      JSON.stringify(updated),
    );
    return updated;
  }

  async clearCart(userId: string): Promise<void> {
    await this.redis.del(this.cartKey(userId));
  }
}
