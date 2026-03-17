import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { AttributeSetController } from './attribute-set.controller';
import { AttributeSetService } from './attribute-set.service';
import { AttributeController } from './attribute.controller';
import { AttributeService } from './attribute.service';

@Module({
  imports: [PrismaModule],
  controllers: [AttributeSetController, AttributeController],
  providers: [AttributeSetService, AttributeService],
  exports: [AttributeSetService, AttributeService],
})
export class AttributeModule {}
