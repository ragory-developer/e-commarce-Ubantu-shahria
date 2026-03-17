import { Test, TestingModule } from '@nestjs/testing';
import { FlashSaleController } from './flash-sale.controller';

describe('FlashSaleController', () => {
  let controller: FlashSaleController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [FlashSaleController],
    }).compile();

    controller = module.get<FlashSaleController>(FlashSaleController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
