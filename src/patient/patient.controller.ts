import { Controller, Get, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../auth/guards/auth.guard';
import { User } from '../auth/decorators/user.decorator';
import { UserInfo } from '../auth/interfaces/user-info.interface';

@Controller('patients')
@UseGuards(AuthGuard)
export class PatientController {
  @Get()
  getPatient(@User() user: UserInfo) {
    return {
      message: 'Patient data retrieved successfully',
      user: user,
      // Add your patient logic here
    };
  }

  @Get('profile')
  getUserProfile(@User() user: UserInfo) {
    return {
      message: 'User profile retrieved',
      profile: {
        id: user.id,
        email: user.email,
        name: user.name,
        roles: user.roles,
      },
    };
  }
}
