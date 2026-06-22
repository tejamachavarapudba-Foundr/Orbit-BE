import { Process, Processor } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import { Job } from 'bull';

@Processor('processing')
export class ProcessingProcessor {
  private log = new Logger('ProcessingProcessor');
  @Process()
  async handle(job: Job) {
    this.log.log(`Processing processing job ${job.id}`);
    // TODO: implement
  }
}
