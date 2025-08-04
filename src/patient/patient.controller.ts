import {
  Controller,
  Get,
  Param,
  UseGuards,
  Query,
  ParseIntPipe,
} from '@nestjs/common';
import { PatientService } from './patient.service';
import { AuthGuard, User, UserInfo } from 'src/auth';
import { PatientSearchDto } from './dto/patient-search.dto';
import { DashboardStatsDto } from './dto/dashboard-stats.dto';

@Controller('patient')
@UseGuards(AuthGuard)
export class PatientController {
  constructor(private readonly patientService: PatientService) {}

  @Get('search')
  async searchPatients(
    @User() user: UserInfo,
    @Query() searchDto: PatientSearchDto,
  ) {
    return this.patientService.searchPatients(user.id, searchDto);
  }

  @Get('dashboard/stats')
  async getDashboardStats(
    @User() user: UserInfo,
    @Query() statsDto: DashboardStatsDto,
  ) {
    return this.patientService.getDashboardStats(user.id, statsDto);
  }

  @Get(':id')
  async getPatientDetails(
    @User() user: UserInfo,
    @Param('id', ParseIntPipe) patientKey: number,
  ) {
    return this.patientService.getPatientDetails(patientKey, user.id);
  }

  @Get(':id/test-history')
  async getPatientTestHistory(
    @User() user: UserInfo,
    @Param('id', ParseIntPipe) patientKey: number,
  ) {
    return this.patientService.getPatientTestHistory(patientKey, user.id);
  }
}
