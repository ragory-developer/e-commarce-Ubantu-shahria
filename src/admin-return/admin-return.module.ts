// src/admin/admin-returns.module.ts

import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { AdminReturnsController } from './admin-return.controller';
import { AdminReturnsService } from './admin-return.service';

@Module({
  imports: [PrismaModule],
  controllers: [AdminReturnsController],
  providers: [AdminReturnsService],
  exports: [AdminReturnsService],
})
export class AdminReturnsModule {}
