import { Test, TestingModule } from '@nestjs/testing';
import { AdminReturnController } from './admin-return.controller';

describe('AdminReturnController', () => {
  let controller: AdminReturnController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AdminReturnController],
    }).compile();

    controller = module.get<AdminReturnController>(AdminReturnController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
