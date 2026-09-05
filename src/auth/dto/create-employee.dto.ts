import { IsEmail, IsEnum, IsNotEmpty, IsString, MinLength } from 'class-validator';

export enum AdminRoleDto {
  ADMIN = 'ADMIN',
  EMPLOYEE = 'EMPLOYEE',
}

export class CreateEmployeeDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsEmail()
  email: string;

  @IsString()
  @MinLength(8)
  password: string;

  @IsEnum(AdminRoleDto)
  role: AdminRoleDto;
}