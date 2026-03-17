// ─── src/media/media.module.ts ────────────────────────────────

import { Module } from '@nestjs/common';
import { ServeStaticModule } from '@nestjs/serve-static';
import * as path from 'path';
import { PrismaModule } from '../prisma/prisma.module';
import { MediaService } from './media.service';
import { MediaController } from './media.controller';

@Module({
  imports: [
    PrismaModule,
    ServeStaticModule.forRoot({
      rootPath: path.join(
        process.cwd(),
        process.env.LOCAL_STORAGE_PATH || 'storage/media',
      ),
      serveRoot: '/uploads/media',
    }),
  ],
  controllers: [MediaController],
  providers: [MediaService],
  exports: [MediaService],
})
export class MediaModule {}
