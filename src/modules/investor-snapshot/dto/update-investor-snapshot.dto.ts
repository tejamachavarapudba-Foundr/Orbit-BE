import { PartialType } from '@nestjs/mapped-types';
import { CreateInvestorSnapshotDto } from './create-investor-snapshot.dto';

export class UpdateInvestorSnapshotDto extends PartialType(
  CreateInvestorSnapshotDto,
) {}