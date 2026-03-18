import { Test, TestingModule } from '@nestjs/testing';
import { DeliveryZoneController } from './delivery-zone.controller';

describe('DeliveryZoneController', () => {
  let controller: DeliveryZoneController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [DeliveryZoneController],
    }).compile();

    controller = module.get<DeliveryZoneController>(DeliveryZoneController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
