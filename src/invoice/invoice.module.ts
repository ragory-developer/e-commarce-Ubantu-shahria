import { Module } from '@nestjs/common';
import { InvoiceService } from './invoice.service';
import { PrismaModule } from '../prisma/prisma.module';
import { ConfigModule } from '@nestjs/config';

@Module({
  imports: [PrismaModule, ConfigModule],
  providers: [InvoiceService],
  exports: [InvoiceService],
})
export class InvoiceModule {}
