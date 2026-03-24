import { Module } from '@nestjs/common';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';

// Core
import { PrismaModule } from './prisma/prisma.module';
import { OtpModule } from './otp/otp.module';
import { AuthModule } from './auth/auth.module';
import { TasksModule } from './tasks/tasks.module';

// Feature Modules
import { AdminModule } from './admin/admin.module';
import { CustomerModule } from './customer/customer.module';
import { AddressModule } from './address/address.module';
import { MediaModule } from './media/media.module';
import { BrandModule } from './brand/brand.module';
import { TagModule } from './tag/tag.module';
import { CategoryModule } from './category/category.module';
import { AttributeModule } from './attribute/attribute.module';
import { FlashSaleModule } from './flash-sale/flash-sale.module';
import { CouponModule } from './coupon/coupon.module';
import { VariationModule } from './variation/variation.module';
import { ProductModule } from './product/product.module';
import { TaxModule } from './tax/tax.module';
import { DeliveryZoneModule } from './delivery-zone/delivery-zone.module';
import { ShippingModule } from './shipping/shipping.module';
import { PromotionModule } from './promotion/promotion.module';
import { CourierModule } from './courier/courier.module';
import { StockReservationModule } from './stock-reservation/stock-reservation.module';
import { WalletModule } from './wallet/wallet.module';
import { AdminReturnsModule } from './admin-return/admin-return.module';
import { AdminWalletModule } from './admin-wallet/admin-wallet.module';
import { SettingsModule } from './settings/settings.module';
import { CurrencyRateModule } from './currency-rate/currency-rate.module';

//New modules
import { NotificationModule } from './notification/notification.module';
import { InvoiceModule } from './invoice/invoice.module';
import { PaymentModule } from './payment/payment.module';
import { OrderModule } from './order/order.module';
import { CheckoutModule } from './checkout/checkout.module';

// Infrastructure
import { AppController } from './app.controller';
import { AppService } from './app.service';
import configuration from './common/config/configuration';
import { validationSchema } from './common/config/validation.schema';
import { GlobalExceptionFilter } from './common/filters/global-exception.filter';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { RolesGuard } from './common/guards/roles.guard';
import { PermissionsGuard } from './common/guards/permissions.guard';
import { UserTypeGuard } from './common/guards/user-type.guard';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
      validationSchema,
      validationOptions: { abortEarly: true },
    }),
    ThrottlerModule.forRoot([
      { name: 'short', ttl: 1000, limit: 10 },
      { name: 'medium', ttl: 10000, limit: 50 },
      { name: 'long', ttl: 60000, limit: 200 },
    ]),

    // ── Core ─────────────────────────────────────────────────────
    PrismaModule,
    OtpModule,
    TasksModule,

    // ── Auth ──────────────────────────────────────────────────────
    AuthModule,
    AdminModule,
    CustomerModule,

    // ── Catalog ───────────────────────────────────────────────────
    AddressModule,
    MediaModule,
    BrandModule,
    TagModule,
    CategoryModule,
    AttributeModule,
    VariationModule,
    ProductModule,

    // ── Commerce ──────────────────────────────────────────────────
    FlashSaleModule,
    CouponModule,
    PromotionModule,
    TaxModule,

    // ── Logistics ─────────────────────────────────────────────────
    DeliveryZoneModule,
    ShippingModule,
    CourierModule,
    StockReservationModule,

    // ── Financials ────────────────────────────────────────────────
    WalletModule,
    AdminWalletModule,
    CurrencyRateModule,

    // ── Operations ────────────────────────────────────────────────
    AdminReturnsModule,
    SettingsModule,

    //Notifications, Invoices, Payments, Orders, Checkout
    NotificationModule,
    InvoiceModule,
    PaymentModule,
    OrderModule,
    CheckoutModule,
  ],

  controllers: [AppController],

  providers: [
    AppService,

    { provide: APP_FILTER, useClass: GlobalExceptionFilter },
    { provide: APP_INTERCEPTOR, useClass: TransformInterceptor },

    // Guard order matters: rate limit → JWT → UserType → Roles → Permissions
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: UserTypeGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
    { provide: APP_GUARD, useClass: PermissionsGuard },
  ],
})
export class AppModule {}
