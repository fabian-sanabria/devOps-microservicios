import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OrdersService } from './orders.service';
import { Order, OrderStatus } from './entities/order.entity';
import { CartService } from '../cart/cart.service';

const mockOrder: Order = {
  id: 'order-uuid-1',
  buyerId: 'buyer-uuid-1',
  items: [{ productId: 'prod-1', productName: 'Test', quantity: 2, unitPrice: 10 }],
  total: 20,
  status: OrderStatus.CONFIRMED,
  paymentId: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const mockRepository = {
  create: jest.fn(),
  save: jest.fn(),
  find: jest.fn(),
  findOne: jest.fn(),
};

const mockCartService = {
  getCart: jest.fn(),
  clearCart: jest.fn(),
};

const mockConfigService = {
  get: jest.fn().mockImplementation((key: string, def?: any) => def),
};

jest.mock('axios');
jest.mock('amqplib');

describe('OrdersService', () => {
  let service: OrdersService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrdersService,
        { provide: getRepositoryToken(Order), useValue: mockRepository },
        { provide: CartService, useValue: mockCartService },
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    service = module.get<OrdersService>(OrdersService);
    jest.clearAllMocks();
  });

  describe('createFromCart', () => {
    it('should throw BadRequestException when cart is empty', async () => {
      mockCartService.getCart.mockResolvedValue([]);
      await expect(service.createFromCart('buyer-uuid-1')).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('findAll', () => {
    it('should return list of buyer orders', async () => {
      mockRepository.find.mockResolvedValue([mockOrder]);
      const result = await service.findAll('buyer-uuid-1');
      expect(result).toHaveLength(1);
      expect(mockRepository.find).toHaveBeenCalledWith({
        where: { buyerId: 'buyer-uuid-1' },
        order: { createdAt: 'DESC' },
      });
    });
  });

  describe('findOne', () => {
    it('should throw NotFoundException when order not found', async () => {
      mockRepository.findOne.mockResolvedValue(null);
      await expect(
        service.findOne('bad-id', 'buyer-uuid-1'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should return order when found', async () => {
      mockRepository.findOne.mockResolvedValue(mockOrder);
      const result = await service.findOne('order-uuid-1', 'buyer-uuid-1');
      expect(result).toEqual(mockOrder);
    });
  });

  describe('updateStatus', () => {
    it('should update order status and paymentId', async () => {
      mockRepository.findOne.mockResolvedValue({ ...mockOrder });
      mockRepository.save.mockResolvedValue({
        ...mockOrder,
        status: OrderStatus.PAID,
        paymentId: 'pay-1',
      });
      await service.updateStatus('order-uuid-1', OrderStatus.PAID, 'pay-1');
      expect(mockRepository.save).toHaveBeenCalled();
    });

    it('should silently skip if order does not exist', async () => {
      mockRepository.findOne.mockResolvedValue(null);
      await expect(
        service.updateStatus('bad-id', OrderStatus.PAID),
      ).resolves.toBeUndefined();
    });
  });
});
