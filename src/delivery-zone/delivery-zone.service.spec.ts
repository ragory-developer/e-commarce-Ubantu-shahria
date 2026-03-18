import { Test, TestingModule } from '@nestjs/testing';
import { DeliveryZoneService } from './delivery-zone.service';

describe('DeliveryZoneService', () => {
  let service: DeliveryZoneService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [DeliveryZoneService],
    }).compile();

    service = module.get<DeliveryZoneService>(DeliveryZoneService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
