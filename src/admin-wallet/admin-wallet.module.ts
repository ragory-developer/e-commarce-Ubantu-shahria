import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { WalletModule } from '../wallet/wallet.module';
import { AdminWalletController } from './admin-wallet.controller';
import { AdminWalletService } from './admin-wallet.service';

@Module({
  imports: [PrismaModule, WalletModule],
  controllers: [AdminWalletController],
  providers: [AdminWalletService],
  exports: [AdminWalletService],
})
export class AdminWalletModule {}
