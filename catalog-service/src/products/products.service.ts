import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, ILike } from 'typeorm';
import { Product } from './entities/product.entity';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { FilterProductDto } from './dto/filter-product.dto';

@Injectable()
export class ProductsService {
  constructor(
    @InjectRepository(Product)
    private readonly productsRepository: Repository<Product>,
  ) {}

  async create(sellerId: string, dto: CreateProductDto): Promise<Product> {
    const product = this.productsRepository.create({ ...dto, sellerId });
    return this.productsRepository.save(product);
  }

  async findAll(filter: FilterProductDto) {
    const { name, category, page = 1, limit = 20 } = filter;
    const where: any = {};
    if (name) where.name = ILike(`%${name}%`);
    if (category) where.category = ILike(`%${category}%`);

    const [data, total] = await this.productsRepository.findAndCount({
      where,
      skip: (page - 1) * limit,
      take: limit,
      order: { createdAt: 'DESC' },
    });

    return {
      data,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  async findOne(id: string): Promise<Product> {
    const product = await this.productsRepository.findOne({ where: { id } });
    if (!product) throw new NotFoundException(`Product ${id} not found`);
    return product;
  }

  async update(
    id: string,
    sellerId: string,
    dto: UpdateProductDto,
  ): Promise<Product> {
    const product = await this.findOne(id);
    if (product.sellerId !== sellerId) {
      throw new ForbiddenException('You can only update your own products');
    }
    Object.assign(product, dto);
    return this.productsRepository.save(product);
  }

  async remove(id: string, sellerId: string): Promise<void> {
    const product = await this.findOne(id);
    if (product.sellerId !== sellerId) {
      throw new ForbiddenException('You can only delete your own products');
    }
    await this.productsRepository.remove(product);
  }

  async decrementStock(id: string, quantity: number): Promise<Product> {
    const product = await this.findOne(id);
    if (product.stock < quantity) {
      throw new ForbiddenException(
        `Insufficient stock for product ${id}: available ${product.stock}, requested ${quantity}`,
      );
    }
    product.stock -= quantity;
    return this.productsRepository.save(product);
  }
}
