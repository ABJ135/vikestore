import { IsBoolean, IsInt, IsOptional } from 'class-validator';

export class UpdateImageDto {
  @IsOptional()
  @IsBoolean()
  isPrimary?: boolean;

  @IsOptional()
  @IsInt()
  sortOrder?: number;
}