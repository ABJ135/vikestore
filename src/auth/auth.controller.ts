import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Post } from '@nestjs/common';
import { AuthService } from './auth.service';
import { RegisterCustomerDto } from './dto/register-customer.dto';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { Public } from '../common/decorators/public.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { CreateEmployeeDto } from './dto/create-employee.dto';
import type { JwtPayload } from './strategies/jwt.strategy';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Get('me')
  getCurrentUser(@CurrentUser() user: JwtPayload) {
    return user;
  }

  @Public()
  @Post('customer/register')
  @HttpCode(HttpStatus.CREATED)
  registerCustomer(@Body() dto: RegisterCustomerDto) {
    return this.authService.registerCustomer(dto);
  }

  @Public()
  @Post('customer/login')
  @HttpCode(HttpStatus.OK)
  loginCustomer(@Body() dto: LoginDto) {
    return this.authService.loginCustomer(dto);
  }

  @Public()
  @Post('customer/refresh')
  @HttpCode(HttpStatus.OK)
  refreshCustomer(@Body() dto: RefreshTokenDto) {
    return this.authService.refreshCustomerTokens(dto.refreshToken);
  }

  @Post('customer/logout')
  @HttpCode(HttpStatus.OK)
  logoutCustomer(@Body() dto: RefreshTokenDto) {
    return this.authService.logoutCustomer(dto.refreshToken);
  }

  @Public()
  @Post('admin/login')
  @HttpCode(HttpStatus.OK)
  loginAdmin(@Body() dto: LoginDto) {
    return this.authService.loginAdmin(dto);
  }

  @Public()
  @Post('admin/forgot-password')
  @HttpCode(HttpStatus.OK)
  forgotAdminPassword(@Body() dto: ForgotPasswordDto) {
    return this.authService.forgotAdminPassword(dto);
  }

  @Public()
  @Post('admin/reset-password')
  @HttpCode(HttpStatus.OK)
  resetAdminPassword(@Body() dto: ResetPasswordDto) {
    return this.authService.resetAdminPassword(dto);
  }

  @Public()
  @Post('admin/refresh')
  @HttpCode(HttpStatus.OK)
  refreshAdmin(@Body() dto: RefreshTokenDto) {
    return this.authService.refreshAdminTokens(dto.refreshToken);
  }

  @Post('admin/logout')
  @HttpCode(HttpStatus.OK)
  logoutAdmin(@Body() dto: RefreshTokenDto) {
    return this.authService.logoutAdmin(dto.refreshToken);
  }

  @Roles('ADMIN')
  @Post('admin/employees')
  @HttpCode(HttpStatus.CREATED)
  createEmployee(@Body() dto: CreateEmployeeDto) {
    return this.authService.createEmployee(dto);
  }

  @Roles('ADMIN')
  @Get('admin/employees')
  listAdmins() {
    return this.authService.listAdmins();
  }

  @Roles('ADMIN')
  @Delete('admin/employees/:id')
  deleteAdmin(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.authService.deleteAdmin(id, user.sub);
  }
}