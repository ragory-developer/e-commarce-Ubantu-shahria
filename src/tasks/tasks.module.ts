// src/tasks/tasks.module.ts

import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { CleanupTask } from './cleanup.task';
import { AuthModule } from '../auth/auth.module';
import { OtpModule } from '../otp/otp.module';

@Module({
  imports: [ScheduleModule.forRoot(), AuthModule, OtpModule],
  providers: [CleanupTask],
})
export class TasksModule {}
