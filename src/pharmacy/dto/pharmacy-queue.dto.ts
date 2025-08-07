import {
  IsOptional,
  IsString,
  IsArray,
  ValidateNested,
  IsDateString,
  IsNumber,
} from 'class-validator';
import { Type } from 'class-transformer';

export class AppointmentDto {
  @IsOptional()
  @IsString()
  id?: string;

  @IsOptional()
  @IsDateString()
  date?: string;
}

export class PatientDto {
  @IsOptional()
  @IsString()
  fullname?: string;

  @IsOptional()
  @IsString()
  ethnicity?: string;

  @IsOptional()
  @IsString()
  marital_status?: string;

  @IsOptional()
  @IsString()
  address1?: string;

  @IsOptional()
  @IsString()
  address2?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  gender?: string;

  @IsOptional()
  @IsString()
  nation?: string;

  @IsOptional()
  @IsString()
  work_address?: string;

  @IsOptional()
  @IsString()
  allergies?: string;

  @IsOptional()
  @IsString()
  personal_history?: string;

  @IsOptional()
  @IsString()
  family_history?: string;

  @IsOptional()
  @IsString()
  citizen_id?: string;
}

export class DoctorDto {
  @IsOptional()
  id?: string | number;

  @IsOptional()
  @IsString()
  name?: string;
}

export class TestResultDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  value?: string;

  @IsOptional()
  @IsString()
  units?: string;

  @IsOptional()
  @IsString()
  reference_range?: string;
}

export class FileAttachmentDto {
  @IsOptional()
  @IsString()
  filename?: string;

  @IsOptional()
  @IsString()
  url?: string;

  @IsOptional()
  @IsString()
  file_type?: string;
}

export class LabTestDto {
  @IsOptional()
  @IsString()
  test_type?: string;

  @IsOptional()
  @IsString()
  test_name?: string;

  @IsOptional()
  @IsString()
  machine?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => DoctorDto)
  taken_by?: DoctorDto;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TestResultDto)
  results?: TestResultDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => FileAttachmentDto)
  file_attachments?: FileAttachmentDto[];

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsString()
  conclusion?: string;
}

export class MedicationDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  dosage?: string;

  @IsOptional()
  @IsString()
  route?: string;

  @IsOptional()
  @IsString()
  frequency?: string;

  @IsOptional()
  @IsString()
  duration?: string;

  @IsOptional()
  @IsString()
  instruction?: string;

  @IsOptional()
  @IsNumber()
  quantity?: number;
}

export class PrescriptionDto {
  @IsOptional()
  @IsDateString()
  issuedDate?: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => MedicationDto)
  medications?: MedicationDto[];
}

export class MedicalRecordDto {
  @IsOptional()
  @ValidateNested()
  @Type(() => DoctorDto)
  incharge_doctor?: DoctorDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => DoctorDto)
  support_doctor?: DoctorDto;

  @IsOptional()
  @IsDateString()
  start_at?: string;

  @IsOptional()
  @IsString()
  reason?: string;

  @IsOptional()
  @IsString()
  current_status?: string;

  @IsOptional()
  @IsString()
  treatment?: string;

  @IsOptional()
  @IsString()
  diagnoses?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => LabTestDto)
  lab_test?: LabTestDto[];

  @IsOptional()
  @ValidateNested()
  @Type(() => PrescriptionDto)
  prescription?: PrescriptionDto;
}

export class PharmacyQueueDto {
  @IsOptional()
  @ValidateNested()
  @Type(() => AppointmentDto)
  appointment?: AppointmentDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => PatientDto)
  patient?: PatientDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => MedicalRecordDto)
  medical_record?: MedicalRecordDto;
}
