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

  @Get('health')
  async healthCheck() {
    return { status: 'ok', timestamp: new Date().toISOString() };
  }

  @Get('search')
  async searchPatients(
    @User() user: UserInfo,
    @Query() searchDto: PatientSearchDto,
  ) {
    console.log('=== PatientController.searchPatients START ===');
    console.log('User info:', { userId: user.id });
    console.log('Search DTO:', JSON.stringify(searchDto, null, 2));

    if (!user.id || typeof user.id !== 'number') {
      console.error('Invalid user ID:', user.id);
      throw new Error('Invalid user authentication');
    }

    try {
      const result = await this.patientService.searchPatients(
        user.id,
        searchDto,
      );
      console.log(
        'Search completed successfully, returning',
        result.data.length,
        'patients',
      );
      console.log('=== PatientController.searchPatients END ===');
      return result;
    } catch (error) {
      console.error('=== PatientController.searchPatients ERROR ===');
      console.error('Error in controller:', error);
      console.error('=== PatientController.searchPatients ERROR END ===');
      throw error;
    }
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
