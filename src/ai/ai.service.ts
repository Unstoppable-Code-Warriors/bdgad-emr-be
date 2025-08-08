import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ChatOpenAI } from '@langchain/openai';
import { PromptTemplate } from '@langchain/core/prompts';
import { JsonOutputParser } from '@langchain/core/output_parsers';
import { v4 as uuidv4 } from 'uuid';
import { PREDEFINED_DOCTORS, DoctorInfo } from './constants/doctors';
import { generateCCCD } from './utils/cccd-generator';
import { PharmacyQueueDto } from '../pharmacy/dto/pharmacy-queue.dto';
import { PatientData, MedicalRecordData } from './types/ai-data.types';

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);
  private readonly llm: ChatOpenAI;

  constructor(private configService: ConfigService) {
    const openaiApiKey = this.configService.get<string>('OPENAI_API_KEY');

    if (!openaiApiKey) {
      this.logger.warn(
        'OPENAI_API_KEY not configured, AI service will use fallback generation',
      );
    }

    this.llm = new ChatOpenAI({
      configuration: { baseURL: 'https://api.yescale.io/v1' },
      openAIApiKey: openaiApiKey,
      modelName: 'gpt-5-nano',
      temperature: 0.8,
    });
  }

  /**
   * Generate AI-powered mock data for pharmacy queue
   */
  async generatePharmacyQueueData(
    customData?: Partial<PharmacyQueueDto>,
  ): Promise<PharmacyQueueDto> {
    try {
      // Generate base data with AI
      const aiGeneratedData = await this.generateAIPatientData();

      // Select random doctor from predefined list
      const doctor = this.getRandomDoctor();

      // Generate medical record data
      const medicalRecord = await this.generateMedicalRecord(
        aiGeneratedData.patient,
        doctor,
      );

      // Combine all data
      const result: PharmacyQueueDto = {
        appointment: {
          id: uuidv4(),
          date: new Date().toISOString(),
        },
        patient: aiGeneratedData.patient,
        medical_record: {
          ...medicalRecord,
          doctor,
        },
        ...customData, // Allow override with custom data
      };

      return result;
    } catch (error) {
      this.logger.error(
        'Failed to generate AI data, falling back to static generation',
        error.stack,
      );
      return this.generateFallbackData(customData);
    }
  }

  /**
   * Generate patient data using AI
   */
  private async generateAIPatientData(): Promise<{ patient: any }> {
    // Set up the JSON output parser
    const parser = new JsonOutputParser<PatientData>();

    const prompt = PromptTemplate.fromTemplate(`
Generate realistic Vietnamese patient information.

{format_instructions}

Requirements:
- Use realistic Vietnamese names
- All text should be in Vietnamese
- Phone numbers should be realistic (0901234567 format)
- Addresses should be real Vietnamese locations
- Medical histories should be realistic but varied
- Gender should be either "Nam" or "Nữ"
- birth_year should be a number between 1950-2010

Structure:
{{
  "patient": {{
    "fullname": "Vietnamese full name (realistic)",
    "ethnicity": "Vietnamese ethnicity (Kinh, Tày, Thái, etc.)",
    "marital_status": "marital status in Vietnamese",
    "address1": "realistic Vietnamese street address",
    "address2": "ward, district, city in Vietnam",
    "phone": "Vietnamese phone number format (10 digits starting with 0)",
    "gender": "Nam or Nữ",
    "nation": "Việt Nam",
    "work_address": "realistic workplace address in Vietnam",
    "allergies": "common allergies in Vietnamese or 'Không có'",
    "personal_history": "realistic medical history in Vietnamese",
    "family_history": "realistic family medical history in Vietnamese",
    "birth_year": number between 1950-2010
  }}
}}
`);

    try {
      const chain = prompt.pipe(this.llm).pipe(parser);

      const aiData = await chain.invoke({
        format_instructions: parser.getFormatInstructions(),
      });

      // Generate CCCD and date_of_birth based on AI data
      const birthYear = aiData.patient.birth_year || 1990;
      const birthDate = this.generateBirthDate(birthYear);
      const cccd = generateCCCD({
        gender: aiData.patient.gender as 'Nam' | 'Nữ',
        birthYear: birthYear,
      });

      aiData.patient.citizen_id = cccd;
      aiData.patient.date_of_birth = birthDate;
      delete aiData.patient.birth_year; // Remove helper field

      return aiData;
    } catch (error) {
      this.logger.error(
        'Failed to generate AI patient data, using fallback',
        error.message,
      );
      return this.generateFallbackPatientData();
    }
  }

  /**
   * Generate medical record using AI
   */
  private async generateMedicalRecord(
    patient: any,
    doctor: DoctorInfo,
  ): Promise<any> {
    // Set up the JSON output parser
    const parser = new JsonOutputParser<MedicalRecordData>();

    const prompt = PromptTemplate.fromTemplate(`
Generate realistic Vietnamese medical record data for patient: {patientName}, Gender: {gender}

{format_instructions}

Structure example:
{{
  "start_at": "ISO datetime string (today around 9-10 AM)",
  "reason": "realistic Vietnamese medical examination reason",
  "current_status": "current patient status in Vietnamese",
  "treatment": "treatment plan in Vietnamese",
  "diagnoses": "medical diagnosis in Vietnamese",
  "lab_test": [
    {{
      "test_type": "Xét nghiệm or Chẩn đoán hình ảnh",
      "test_name": "realistic test name in Vietnamese",
      "machine": "realistic medical equipment name",
      "taken_by": {{
        "id": "uuid",
        "name": "Vietnamese technician name"
      }},
      "results": [array of test results with name, value, units, reference_range],
      "notes": "notes in Vietnamese",
      "conclusion": "conclusion in Vietnamese"
    }}
  ],
  "prescription": {{
    "issuedDate": "ISO datetime string (today around 10:30 AM)",
    "notes": "prescription notes in Vietnamese",
    "medications": [
      {{
        "name": "realistic Vietnamese medication name with dosage",
        "dosage": "dosage amount",
        "route": "Uống, Tiêm, etc.",
        "frequency": "frequency in Vietnamese",
        "duration": "duration in Vietnamese",
        "instruction": "instructions in Vietnamese",
        "quantity": number
      }}
    ]
  }}
}}

Make it realistic for Vietnamese healthcare context.
`);

    try {
      const chain = prompt.pipe(this.llm).pipe(parser);

      const medicalData = await chain.invoke({
        format_instructions: parser.getFormatInstructions(),
        patientName: patient.fullname,
        gender: patient.gender,
      });

      // Add file attachments for imaging tests
      if (medicalData.lab_test) {
        medicalData.lab_test.forEach((test: any) => {
          if (test.test_type === 'Chẩn đoán hình ảnh') {
            test.file_attachments = this.generateFileAttachments();
          }
        });
      }

      return medicalData;
    } catch (error) {
      this.logger.error(
        'Failed to generate medical record with AI, using fallback',
        error.message,
      );
      return this.generateFallbackMedicalRecord();
    }
  }

  /**
   * Get random doctor from predefined list
   */
  private getRandomDoctor(): DoctorInfo {
    return PREDEFINED_DOCTORS[
      Math.floor(Math.random() * PREDEFINED_DOCTORS.length)
    ];
  }

  /**
   * Generate birth date from birth year
   */
  private generateBirthDate(birthYear: number): string {
    const month = Math.floor(Math.random() * 12) + 1;
    const day = Math.floor(Math.random() * 28) + 1;
    return `${birthYear}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
  }

  /**
   * Generate file attachments for medical tests
   */
  private generateFileAttachments(): any[] {
    const timestamp = Date.now();
    const dateStr = new Date().toISOString().split('T')[0].replace(/-/g, '');

    return [
      {
        filename: `patient${timestamp}_CXR_${dateStr}.pdf`,
        url: `/path/to/ehr/files/patient${timestamp}_CXR_${dateStr}.pdf`,
        file_type: 'application/pdf',
        file_size: 216974,
      },
      {
        filename: `patient${timestamp}_CXR_${dateStr}_image.dcm`,
        url: `/path/to/ehr/files/patient${timestamp}_CXR_${dateStr}_image.dcm`,
        file_type: 'application/dicom',
        file_size: 216974,
      },
    ];
  }

  /**
   * Fallback data generation when AI is not available
   */
  private generateFallbackData(
    customData?: Partial<PharmacyQueueDto>,
  ): PharmacyQueueDto {
    const fallbackPatient = this.generateFallbackPatientData();
    const doctor = this.getRandomDoctor();

    return {
      appointment: {
        id: uuidv4(),
        date: new Date().toISOString(),
      },
      patient: fallbackPatient.patient,
      medical_record: {
        ...this.generateFallbackMedicalRecord(),
        doctor,
      },
      ...customData,
    };
  }

  /**
   * Fallback patient data generation
   */
  private generateFallbackPatientData(): { patient: any } {
    const genders = ['Nam', 'Nữ'];
    const gender = genders[Math.floor(Math.random() * genders.length)];
    const birthYear = 1970 + Math.floor(Math.random() * 40); // 1970-2009

    return {
      patient: {
        fullname: 'Nguyễn Thị Mai',
        ethnicity: 'Kinh',
        marital_status: 'Đã kết hôn',
        address1: '123 Nguyễn Văn Cừ',
        address2: 'Phường 4, Quận 5, TP.HCM',
        phone: '0908123456',
        gender,
        nation: 'Việt Nam',
        work_address: 'Công ty ABC, Quận 1, TP.HCM',
        allergies: 'Không có',
        personal_history: 'Tiền sử cao huyết áp',
        family_history: 'Cha bị tiểu đường',
        citizen_id: generateCCCD({ gender: gender as 'Nam' | 'Nữ', birthYear }),
        date_of_birth: this.generateBirthDate(birthYear),
      },
    };
  }

  /**
   * Fallback medical record generation
   */
  private generateFallbackMedicalRecord(): any {
    return {
      start_at: new Date().toISOString(),
      reason: 'Khám sức khỏe định kỳ',
      current_status: 'Bệnh nhân tỉnh, sinh hiệu ổn',
      treatment: 'Theo dõi huyết áp, điều chỉnh chế độ ăn',
      diagnoses: 'Tăng huyết áp độ 1',
      lab_test: [
        {
          test_type: 'Xét nghiệm',
          test_name: 'Công thức máu toàn bộ',
          machine: 'Sysmex XN-1000',
          taken_by: {
            id: uuidv4(),
            name: 'Nguyễn Văn Bình',
          },
          results: [
            {
              name: 'Hồng cầu',
              value: '4.8',
              units: '10^12/L',
              reference_range: '4.2 - 5.4',
            },
            {
              name: 'Bạch cầu',
              value: '6.5',
              units: '10^9/L',
              reference_range: '4.0 - 10.0',
            },
          ],
          notes: 'Chỉ số trong giới hạn bình thường.',
          conclusion: 'Không có bất thường.',
        },
      ],
      prescription: {
        issuedDate: new Date().toISOString(),
        notes: 'Theo dõi huyết áp mỗi ngày tại nhà. Tái khám sau 2 tuần.',
        medications: [
          {
            name: 'Amlodipine 5mg',
            dosage: '1 viên/ngày',
            route: 'Uống',
            frequency: '1 lần/ngày',
            duration: '30 ngày',
            instruction: 'Uống vào buổi sáng sau khi ăn',
            quantity: 30,
          },
        ],
      },
    };
  }
}
