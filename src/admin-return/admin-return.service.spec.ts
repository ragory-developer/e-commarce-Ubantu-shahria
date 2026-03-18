import { Test, TestingModule } from '@nestjs/testing';
import { AdminReturnService } from './admin-return.service';

describe('AdminReturnService', () => {
  let service: AdminReturnService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [AdminReturnService],
    }).compile();

    service = module.get<AdminReturnService>(AdminReturnService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
