import { IsOptional, IsString, IsIn } from 'class-validator';

export class DashboardStatsDto {
  @IsOptional()
  @IsString()
  @IsIn(['day', 'week', 'month', 'year'])
  period?: 'day' | 'week' | 'month' | 'year' = 'week';
}
