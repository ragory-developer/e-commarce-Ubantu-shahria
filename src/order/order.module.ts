import { Module } from '@nestjs/common';
import { OrderController } from './order.controller';
import { OrderAdminController } from './order-admin.controller';
import { OrderService } from './order.service';
import { PrismaModule } from '../prisma/prisma.module';
import { WalletModule } from '../wallet/wallet.module';
import { CouponModule } from '../coupon/coupon.module';
import { NotificationModule } from '../notification/notification.module';
import { InvoiceModule } from '../invoice/invoice.module';

@Module({
  imports: [
    PrismaModule,
    WalletModule,
    CouponModule,
    NotificationModule,
    InvoiceModule,
  ],
  controllers: [OrderController, OrderAdminController],
  providers: [OrderService],
  exports: [OrderService],
})
export class OrderModule {}
