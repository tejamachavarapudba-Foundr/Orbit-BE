import { IsEnum, IsNotEmpty } from 'class-validator';

export class UpdateStatusDto {
  @IsEnum(['pending', 'founder_contacted', 'approved', 'rejected', 'completed'], {
    message: 'Status must be a valid option: pending, founder_contacted, approved, rejected, or completed',
  })
  @IsNotEmpty()
  status: 'pending' | 'founder_contacted' | 'approved' | 'rejected' | 'completed';
}
