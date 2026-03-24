// src/admin/admin-returns.module.ts

import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { AdminReturnsController } from './admin-return.controller';
import { AdminReturnsService } from './admin-return.service';
import { WalletModule } from '../wallet/wallet.module';

@Module({
  imports: [PrismaModule, WalletModule],
  controllers: [AdminReturnsController],
  providers: [AdminReturnsService],
  exports: [AdminReturnsService],
})
export class AdminReturnsModule {}
