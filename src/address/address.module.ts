import { Module } from '@nestjs/common';
import { AddressController } from './address.controller';
import { LocationController } from './location.controller';
import { AddressService } from './address.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [
    AddressController,
    LocationController, // Public location hierarchy endpoints
  ],
  providers: [AddressService],
  exports: [AddressService], // Exported for use by OrderService
})
export class AddressModule {}
