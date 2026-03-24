import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { StockReservationService } from './stock-reservation.service';

@Module({
  imports: [PrismaModule],
  providers: [StockReservationService],
  exports: [StockReservationService],
})
export class StockReservationModule {}
