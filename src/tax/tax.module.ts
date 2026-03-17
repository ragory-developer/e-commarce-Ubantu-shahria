// ─── src/tax/tax.module.ts ────────────────────────────────────

import { Module } from '@nestjs/common';
import { TaxController } from './tax.controller';
import { TaxService } from './tax.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [TaxController],
  providers: [TaxService],
  exports: [TaxService], // OrderModule will import TaxModule for calculateTax()
})
export class TaxModule {}
