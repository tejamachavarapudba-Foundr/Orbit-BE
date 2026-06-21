import { IsEnum, IsNotEmpty } from 'class-validator';

export class UpdateStatusDto {
  @IsEnum(['pending', 'founder_contacted', 'approved', 'rejected'], {
    message: 'Status must be a valid option: pending, founder_contacted, approved, or rejected',
  })
  @IsNotEmpty()
  status: 'pending' | 'founder_contacted' | 'approved' | 'rejected';
}
