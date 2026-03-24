import {
  Controller,
  Post,
  Get,
  Patch,
  Delete,
  Body,
  Param,
  HttpCode,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiResponse,
} from '@nestjs/swagger';
import { CheckoutService } from './checkout.service';
import { OrderService } from '../order/order.service';
import { PaymentService } from '../payment/payment.service';
import {
  InitiateCheckoutDto,
  UpdateItemsDto,
  SetAddressDto,
  ApplyCouponDto,
  SelectPaymentDto,
  PlaceOrderDto,
  SetWalletAmountDto,
} from './dto';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { OptionalAuth } from '../common/decorators/optional-auth.decorator';
import { Public } from '../common/decorators/public.decorator';
import type { RequestUser } from '../auth/auth.types';

@ApiTags('Checkout')
@Controller('checkout')
export class CheckoutController {
  constructor(
    private readonly checkoutSvc: CheckoutService,
    private readonly orderSvc: OrderService,
    private readonly paymentSvc: PaymentService,
  ) {}

  // ─── Step 1: Initiate ─────────────────────────────────────────
  @Post('initiate')
  @OptionalAuth()
  @ApiOperation({
    summary: 'Step 1 – Initiate checkout (validate items, reserve stock)',
    description:
      'Call this when user starts checkout. Items are validated and stock is reserved.',
  })
  async initiate(
    @Body() dto: InitiateCheckoutDto,
    @CurrentUser() user: RequestUser | null,
  ) {
    const data = await this.checkoutSvc.initiate(dto, user?.id);
    return { message: 'Checkout initiated', data };
  }

  // ─── Update items ──────────────────────────────────────────────
  @Patch(':sessionId/items')
  @OptionalAuth()
  @ApiParam({ name: 'sessionId' })
  @ApiOperation({ summary: 'Update cart items in checkout session' })
  async updateItems(
    @Param('sessionId') sessionId: string,
    @Body() dto: UpdateItemsDto,
    @CurrentUser() user: RequestUser | null,
  ) {
    const data = await this.checkoutSvc.updateItems(sessionId, dto, user?.id);
    return { message: 'Items updated', data };
  }

  // ─── Step 2: Set Address ───────────────────────────────────────
  @Patch(':sessionId/address')
  @OptionalAuth()
  @ApiParam({ name: 'sessionId' })
  @ApiOperation({
    summary: 'Step 2 – Set delivery address and get shipping options',
    description:
      'For authenticated users, pass addressId. For guests, pass address object.',
  })
  async setAddress(
    @Param('sessionId') sessionId: string,
    @Body() dto: SetAddressDto,
    @CurrentUser() user: RequestUser | null,
  ) {
    const data = await this.checkoutSvc.setAddress(sessionId, dto, user?.id);
    return { message: 'Address set', data };
  }

  // ─── Step 3: Apply Coupon ──────────────────────────────────────
  @Post(':sessionId/coupon')
  @OptionalAuth()
  @HttpCode(HttpStatus.OK)
  @ApiParam({ name: 'sessionId' })
  @ApiOperation({ summary: 'Step 3 (optional) – Apply coupon code' })
  async applyCoupon(
    @Param('sessionId') sessionId: string,
    @Body() dto: ApplyCouponDto,
    @CurrentUser() user: RequestUser | null,
  ) {
    const data = await this.checkoutSvc.applyCoupon(sessionId, dto, user?.id);
    return { message: 'Coupon applied', data };
  }

  // ─── Remove Coupon ─────────────────────────────────────────────
  @Delete(':sessionId/coupon')
  @OptionalAuth()
  @HttpCode(HttpStatus.OK)
  @ApiParam({ name: 'sessionId' })
  @ApiOperation({ summary: 'Remove applied coupon' })
  async removeCoupon(
    @Param('sessionId') sessionId: string,
    @CurrentUser() user: RequestUser | null,
  ) {
    await this.checkoutSvc.removeCoupon(sessionId, user?.id);
    return { message: 'Coupon removed', data: null };
  }

  // ─── Set Wallet Amount ─────────────────────────────────────────
  @Patch(':sessionId/wallet')
  @ApiBearerAuth('access-token')
  @ApiParam({ name: 'sessionId' })
  @ApiOperation({
    summary: 'Apply wallet balance to checkout (authenticated customers only)',
  })
  async setWallet(
    @Param('sessionId') sessionId: string,
    @Body() dto: SetWalletAmountDto,
    @CurrentUser() user: RequestUser,
  ) {
    const data = await this.checkoutSvc.setWalletAmount(
      sessionId,
      dto,
      user.id,
    );
    return { message: 'Wallet amount set', data };
  }

  // ─── Step 4: Select Payment ────────────────────────────────────
  @Patch(':sessionId/payment')
  @OptionalAuth()
  @ApiParam({ name: 'sessionId' })
  @ApiOperation({
    summary: 'Step 4 – Select payment method',
    description:
      'COD places order directly. Online payments return a payment URL.',
  })
  async selectPayment(
    @Param('sessionId') sessionId: string,
    @Body() dto: SelectPaymentDto,
    @CurrentUser() user: RequestUser | null,
  ) {
    const data = await this.checkoutSvc.selectPayment(sessionId, dto, user?.id);
    return { message: 'Payment method selected', data };
  }

  // ─── Summary ───────────────────────────────────────────────────
  @Get(':sessionId/summary')
  @OptionalAuth()
  @ApiParam({ name: 'sessionId' })
  @ApiOperation({ summary: 'Get full checkout summary with pricing breakdown' })
  async getSummary(
    @Param('sessionId') sessionId: string,
    @CurrentUser() user: RequestUser | null,
  ) {
    const data = await this.checkoutSvc.getSummary(sessionId, user?.id);
    return { message: 'Summary retrieved', data };
  }

  // ─── Step 5: Place Order (COD) ─────────────────────────────────
  @Post(':sessionId/place-order')
  @OptionalAuth()
  @ApiParam({ name: 'sessionId' })
  @ApiOperation({
    summary: 'Step 5 – Place order (COD)',
    description:
      'Creates order immediately. For online payments, use /initiate-payment instead.',
  })
  async placeOrder(
    @Param('sessionId') sessionId: string,
    @Body() dto: PlaceOrderDto,
    @CurrentUser() user: RequestUser | null,
  ) {
    // Validate session first
    await this.checkoutSvc.placeOrder(sessionId, dto, user?.id);
    // Delegate actual order creation to OrderService (transaction-safe)
    const order = await this.orderSvc.createFromSession(
      sessionId,
      user?.id,
      dto.notes,
    );
    return {
      message: 'Order placed successfully',
      data: { orderId: order.id, orderNumber: order.orderNumber },
    };
  }

  // ─── Initiate Online Payment ───────────────────────────────────
  @Post(':sessionId/initiate-payment')
  @OptionalAuth()
  @ApiParam({ name: 'sessionId' })
  @ApiOperation({
    summary: 'Initiate online payment (SSLCommerz)',
    description:
      'Returns payment URL. Redirect user to this URL to complete payment.',
  })
  async initiatePayment(
    @Param('sessionId') sessionId: string,
    @CurrentUser() user: RequestUser | null,
  ) {
    const data = await this.paymentSvc.initiateOnlinePayment(
      sessionId,
      user?.id,
    );
    return { message: 'Payment initiated', data };
  }

  // ─── Cancel ───────────────────────────────────────────────────
  @Post(':sessionId/cancel')
  @OptionalAuth()
  @HttpCode(HttpStatus.OK)
  @ApiParam({ name: 'sessionId' })
  @ApiOperation({ summary: 'Cancel checkout and release stock reservations' })
  async cancel(
    @Param('sessionId') sessionId: string,
    @CurrentUser() user: RequestUser | null,
  ) {
    await this.checkoutSvc.cancelCheckout(sessionId, user?.id);
    return { message: 'Checkout cancelled', data: null };
  }
}
