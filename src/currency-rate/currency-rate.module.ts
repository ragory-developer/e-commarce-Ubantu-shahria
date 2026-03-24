import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { CurrencyRateController } from './currency-rate.controller';
import { CurrencyRateService } from './currency-rate.service';

@Module({
  imports: [PrismaModule],
  controllers: [CurrencyRateController],
  providers: [CurrencyRateService],
  exports: [CurrencyRateService],
})
export class CurrencyRateModule {}
