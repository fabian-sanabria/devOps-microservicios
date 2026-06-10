import { IsInt, IsPositive, IsUUID } from 'class-validator';
import { Type } from 'class-transformer';

export class AddToCartDto {
  @IsUUID()
  productId: string;

  @Type(() => Number)
  @IsInt()
  @IsPositive()
  quantity: number;
}

export class RemoveFromCartDto {
  @IsUUID()
  productId: string;
}
