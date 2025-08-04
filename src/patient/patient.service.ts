import { Injectable } from '@nestjs/common';

@Injectable()
export class PatientService {
  findAll() {
    return `This action returns all patient`;
  }

  findOne(id: number) {
    return `This action returns a #${id} patient`;
  }
}
