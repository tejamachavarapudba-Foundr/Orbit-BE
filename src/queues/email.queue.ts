import { Process, Processor } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import { Job } from 'bull';

@Processor('email')
export class EmailProcessor {
  private log = new Logger('EmailProcessor');
  @Process()
  async handle(job: Job) {
    this.log.log(`Processing email job ${job.id}`);
    // TODO: implement
  }
}
