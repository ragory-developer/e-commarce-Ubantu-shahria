import { Module } from '@nestjs/common';
import { DeliveryZoneController } from './delivery-zone.controller';
import { DeliveryZoneService } from './delivery-zone.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [DeliveryZoneController],
  providers: [DeliveryZoneService],
  exports: [DeliveryZoneService],
})
export class DeliveryZoneModule {}
