import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { ProductsService } from './products.service';
import { Product } from './entities/product.entity';

const mockProduct: Product = {
  id: 'prod-uuid-1',
  name: 'Test Product',
  description: 'A test product',
  price: 29.99,
  stock: 10,
  category: 'Electronics',
  sellerId: 'seller-uuid-1',
  createdAt: new Date(),
  updatedAt: new Date(),
};

const mockRepository = {
  create: jest.fn(),
  save: jest.fn(),
  findOne: jest.fn(),
  findAndCount: jest.fn(),
  remove: jest.fn(),
};

describe('ProductsService', () => {
  let service: ProductsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProductsService,
        { provide: getRepositoryToken(Product), useValue: mockRepository },
      ],
    }).compile();

    service = module.get<ProductsService>(ProductsService);
    jest.clearAllMocks();
  });

  describe('create', () => {
    it('should create a product for a seller', async () => {
      mockRepository.create.mockReturnValue(mockProduct);
      mockRepository.save.mockResolvedValue(mockProduct);

      const result = await service.create('seller-uuid-1', {
        name: 'Test Product',
        price: 29.99,
        stock: 10,
        category: 'Electronics',
      });

      expect(result).toEqual(mockProduct);
    });
  });

  describe('findAll', () => {
    it('should return paginated products', async () => {
      mockRepository.findAndCount.mockResolvedValue([[mockProduct], 1]);

      const result = await service.findAll({ page: 1, limit: 20 });

      expect(result.data).toHaveLength(1);
      expect(result.meta.total).toBe(1);
    });
  });

  describe('findOne', () => {
    it('should return a product by id', async () => {
      mockRepository.findOne.mockResolvedValue(mockProduct);
      const result = await service.findOne('prod-uuid-1');
      expect(result).toEqual(mockProduct);
    });

    it('should throw NotFoundException when not found', async () => {
      mockRepository.findOne.mockResolvedValue(null);
      await expect(service.findOne('bad-id')).rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    it('should throw ForbiddenException if seller does not own product', async () => {
      mockRepository.findOne.mockResolvedValue(mockProduct);
      await expect(
        service.update('prod-uuid-1', 'other-seller', { name: 'New Name' }),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('decrementStock', () => {
    it('should decrement stock successfully', async () => {
      mockRepository.findOne.mockResolvedValue({ ...mockProduct, stock: 10 });
      mockRepository.save.mockResolvedValue({ ...mockProduct, stock: 7 });

      const result = await service.decrementStock('prod-uuid-1', 3);
      expect(result.stock).toBe(7);
    });

    it('should throw ForbiddenException on insufficient stock', async () => {
      mockRepository.findOne.mockResolvedValue({ ...mockProduct, stock: 2 });
      await expect(
        service.decrementStock('prod-uuid-1', 5),
      ).rejects.toThrow(ForbiddenException);
    });
  });
});
