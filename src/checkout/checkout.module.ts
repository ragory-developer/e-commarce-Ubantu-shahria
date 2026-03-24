import { Module } from '@nestjs/common';
import { CheckoutController } from './checkout.controller';
import { CheckoutService } from './checkout.service';
import { PrismaModule } from '../prisma/prisma.module';
import { StockReservationModule } from '../stock-reservation/stock-reservation.module';
import { ProductModule } from '../product/product.module';
import { CouponModule } from '../coupon/coupon.module';
import { WalletModule } from '../wallet/wallet.module';
import { ShippingModule } from '../shipping/shipping.module';
import { AddressModule } from '../address/address.module';
import { OrderModule } from '../order/order.module';
import { PaymentModule } from '../payment/payment.module';

@Module({
  imports: [
    PrismaModule,
    StockReservationModule,
    ProductModule,
    CouponModule,
    WalletModule,
    ShippingModule,
    AddressModule,
    OrderModule,
    PaymentModule,
  ],
  controllers: [CheckoutController],
  providers: [CheckoutService],
  exports: [CheckoutService],
})
export class CheckoutModule {}
