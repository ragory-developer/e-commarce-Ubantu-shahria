import { Module } from '@nestjs/common';
import { PaymentController } from './payment.controller';
import { PaymentService } from './payment.service';
import { CodStrategy } from './strategies/cod.strategy';
import { SslcommerzStrategy } from './strategies/sslcommerz.strategy';
import { PrismaModule } from '../prisma/prisma.module';
import { OrderModule } from '../order/order.module';
import { ConfigModule } from '@nestjs/config';

@Module({
  imports: [PrismaModule, OrderModule, ConfigModule],
  controllers: [PaymentController],
  providers: [PaymentService, CodStrategy, SslcommerzStrategy],
  exports: [PaymentService],
})
export class PaymentModule {}
