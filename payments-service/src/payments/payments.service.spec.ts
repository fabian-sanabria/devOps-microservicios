import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { PaymentsService } from './payments.service';
import { Payment, PaymentStatus } from './entities/payment.entity';

const mockPayment: Payment = {
  id: 'pay-uuid-1',
  orderId: 'order-uuid-1',
  amount: 99.99,
  status: PaymentStatus.APPROVED,
  idempotencyKey: 'order-order-uuid-1',
  createdAt: new Date(),
};

const mockRepository = {
  findOne: jest.fn(),
  create: jest.fn(),
  save: jest.fn(),
};

describe('PaymentsService', () => {
  let service: PaymentsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PaymentsService,
        { provide: getRepositoryToken(Payment), useValue: mockRepository },
      ],
    }).compile();

    service = module.get<PaymentsService>(PaymentsService);
    jest.clearAllMocks();
  });

  describe('processPayment — idempotency', () => {
    it('should return existing payment if idempotency key already exists', async () => {
      mockRepository.findOne.mockResolvedValue(mockPayment);

      const result = await service.processPayment({
        orderId: 'order-uuid-1',
        amount: 99.99,
        idempotencyKey: 'order-order-uuid-1',
      });

      expect(result).toEqual(mockPayment);
      expect(mockRepository.create).not.toHaveBeenCalled();
      expect(mockRepository.save).not.toHaveBeenCalled();
    });

    it('should create new payment when idempotency key is fresh', async () => {
      mockRepository.findOne.mockResolvedValue(null);
      mockRepository.create.mockReturnValue(mockPayment);
      mockRepository.save.mockResolvedValue(mockPayment);

      const result = await service.processPayment({
        orderId: 'order-uuid-1',
        amount: 99.99,
        idempotencyKey: 'order-order-uuid-1',
      });

      expect(mockRepository.create).toHaveBeenCalled();
      expect(mockRepository.save).toHaveBeenCalled();
      expect(result).toHaveProperty('id');
    });
  });

  describe('processPayment — simulation', () => {
    it('should reject payment with amount <= 0', async () => {
      mockRepository.findOne.mockResolvedValue(null);
      mockRepository.create.mockImplementation((data) => ({ ...data }));
      mockRepository.save.mockImplementation((p) => Promise.resolve({ ...p, id: 'new-id' }));

      const result = await service.processPayment({
        orderId: 'order-uuid-2',
        amount: 0,
        idempotencyKey: 'key-zero',
      });

      expect(result.status).toBe(PaymentStatus.REJECTED);
    });
  });
});
