import { IsOptional, IsString, IsNumber, IsBoolean } from 'class-validator';

export class CreateInvestorSnapshotDto {
  @IsOptional()
  @IsString()
  targetCustomers?: string;

  @IsOptional()
  @IsString()
  businessModel?: string;

  @IsOptional()
  @IsString()
  revenueStreams?: string;

  @IsOptional()
  @IsString()
  marketOpportunity?: string;

  @IsOptional()
  @IsString()
  startupVision?: string;

  @IsOptional()
  @IsString()
  problemStatement?: string;

  @IsOptional()
  @IsString()
  solutionSummary?: string;

  @IsOptional()
  @IsNumber()
  totalUsers?: number;

  @IsOptional()
  @IsNumber()
  activeUsers?: number;

  @IsOptional()
  @IsNumber()
  payingCustomers?: number;

  @IsOptional()
  @IsNumber()
  mrr?: number;

  @IsOptional()
  @IsNumber()
  arr?: number;

  @IsOptional()
  @IsNumber()
  burnRate?: number;

  @IsOptional()
  @IsNumber()
  runwayMonths?: number;

  @IsOptional()
  @IsNumber()
  cac?: number;

  @IsOptional()
  @IsNumber()
  ltv?: number;

  @IsOptional()
  @IsNumber()
  ebitda?: number;

  @IsOptional()
  @IsNumber()
  amountRaising?: number;

  @IsOptional()
  @IsNumber()
  equityOffered?: number;

  @IsOptional()
  @IsBoolean()
  isCompleted?: boolean;
}