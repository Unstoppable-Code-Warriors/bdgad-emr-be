import { Controller, Get, Param, UseGuards, Query } from '@nestjs/common';
import { PatientService } from './patient.service';
import { AuthGuard, User, UserInfo } from 'src/auth';

@Controller('patient')
@UseGuards(AuthGuard)
export class PatientController {
  constructor(private readonly patientService: PatientService) {}

  @Get()
  getPatients(
    @User() user: UserInfo,
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '10',
    @Query('search') search?: string,
    @Query('gender') gender?: string,
    @Query('sortBy') sortBy: string = 'FullName',
    @Query('sortOrder') sortOrder: 'ASC' | 'DESC' = 'ASC',
  ) {
    console.log('🔍 [PatientController] getPatients called by user:', user.id);
    console.log('🔍 [PatientController] Query params:', {
      page,
      limit,
      search,
      gender,
      sortBy,
      sortOrder,
    });

    const pageNum = parseInt(page, 10);
    const limitNum = parseInt(limit, 10);

    return this.patientService.getPatientsByDoctor(user.id, {
      page: pageNum,
      limit: limitNum,
      search,
      gender,
      sortBy,
      sortOrder,
    });
  }

  @Get(':id')
  getPatientById(@User() user: UserInfo, @Param('id') id: string) {
    console.log(
      '🔍 [PatientController] getPatientById called by user:',
      user.id,
    );
    console.log('🔍 [PatientController] Patient ID:', id);

    return this.patientService.getPatientByIdForDoctor(user.id, +id);
  }
}
