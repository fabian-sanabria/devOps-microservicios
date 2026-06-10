import { IsInt, IsPositive } from 'class-validator';
import { Type } from 'class-transformer';

export class DecrementStockDto {
  @Type(() => Number)
  @IsInt()
  @IsPositive()
  quantity: number;
}
