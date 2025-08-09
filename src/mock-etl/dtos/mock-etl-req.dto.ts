import { IsEnum, IsNotEmpty, IsNumber, IsString } from 'class-validator';

enum Sex {
  MALE = 'XY',
  FEMALE = 'XX',
}

export class MockEtlReqDto {
  @IsString()
  @IsNotEmpty()
  analysis_id: string;

  @IsString()
  @IsNotEmpty()
  patient_id: string;

  @IsString()
  @IsNotEmpty()
  sample_name: string;

  @IsEnum(Sex)
  @IsNotEmpty()
  sex: Sex;

  @IsNumber()
  @IsNotEmpty()
  status: number;

  @IsString()
  @IsNotEmpty()
  lane: string;

  @IsString()
  @IsNotEmpty()
  fastq_1_url: string;

  @IsString()
  @IsNotEmpty()
  fastq_2_url: string;

  @IsString()
  @IsNotEmpty()
  genome: string;

  @IsString()
  @IsNotEmpty()
  email: string;
}
