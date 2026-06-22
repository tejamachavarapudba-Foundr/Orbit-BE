import { Process, Processor } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import { Job } from 'bull';

@Processor('notification')
export class NotificationProcessor {
  private log = new Logger('NotificationProcessor');
  @Process()
  async handle(job: Job) {
    this.log.log(`Processing notification job ${job.id}`);
    // TODO: implement
  }
}
