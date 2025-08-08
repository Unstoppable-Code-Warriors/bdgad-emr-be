import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { v4 as uuidv4 } from 'uuid';
import { PREDEFINED_DOCTORS, DoctorInfo } from './constants/doctors';
import { generateCCCD } from './utils/cccd-generator';
import { PharmacyQueueDto } from '../pharmacy/dto/pharmacy-queue.dto';
import {
  VIETNAMESE_LAST_NAMES,
  VIETNAMESE_MALE_FIRST_NAMES,
  VIETNAMESE_FEMALE_FIRST_NAMES,
  VIETNAMESE_ETHNICITIES,
  MARITAL_STATUSES,
  VIETNAM_CITIES,
  HCM_DISTRICTS,
  HANOI_DISTRICTS,
  COMMON_ALLERGIES,
  PERSONAL_HISTORIES,
  FAMILY_HISTORIES,
  WORK_PLACES,
  getRandomElement,
  generateVietnamesePhone,
  generateStreetAddress,
} from './constants/patient-data';
import {
  EXAMINATION_REASONS,
  CURRENT_STATUSES,
  TREATMENTS,
  DIAGNOSES,
  LAB_TEST_TYPES,
  BLOOD_TESTS,
  IMAGING_TESTS,
  MEDICAL_MACHINES,
  TECHNICIAN_NAMES,
  MEDICATIONS,
  PRESCRIPTION_NOTES,
  BLOOD_TEST_RESULTS,
  TEST_CONCLUSIONS,
  TEST_NOTES,
} from './constants/medical-data';

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);

  constructor(private configService: ConfigService) {}

  /**
   * Generate mock data for pharmacy queue using constants and random logic
   */
  async generatePharmacyQueueData(
    customData?: Partial<PharmacyQueueDto>,
  ): Promise<PharmacyQueueDto> {
    try {
      // Generate base data using constants
      const patientData = this.generatePatientData();

      // Select random doctor from predefined list
      const doctor = this.getRandomDoctor();

      // Generate medical record data
      const medicalRecord = this.generateMedicalRecord(
        patientData.patient,
        doctor,
      );

      // Combine all data
      const result: PharmacyQueueDto = {
        appointment: {
          id: uuidv4(),
          date: new Date().toISOString(),
        },
        patient: patientData.patient,
        medical_record: {
          ...medicalRecord,
          doctor,
        },
        ...customData, // Allow override with custom data
      };

      return result;
    } catch (error) {
      this.logger.error(
        'Failed to generate data, falling back to static generation',
        error.stack,
      );
      return this.generateFallbackData(customData);
    }
  }

  /**
   * Generate patient data using constants and random combinations
   */
  private generatePatientData(): { patient: any } {
    const gender = getRandomElement(['Nam', 'Nữ']);
    const birthYear = 1950 + Math.floor(Math.random() * 61); // 1950-2010

    // Generate name based on gender
    const lastName = getRandomElement(VIETNAMESE_LAST_NAMES);
    const firstName =
      gender === 'Nam'
        ? getRandomElement(VIETNAMESE_MALE_FIRST_NAMES)
        : getRandomElement(VIETNAMESE_FEMALE_FIRST_NAMES);
    const fullname = `${lastName} ${firstName}`;

    // Generate address (diversify by city)
    const city = getRandomElement(VIETNAM_CITIES);
    let district: string;

    if (city === 'TP.HCM') {
      district = getRandomElement(HCM_DISTRICTS);
    } else if (city === 'Hà Nội') {
      district = getRandomElement(HANOI_DISTRICTS);
    } else {
      // Generate generic district for other cities
      const districtTypes = ['Quận', 'Huyện'];
      const districtNames = [
        'Trung tâm',
        'Nam',
        'Bắc',
        'Đông',
        'Tây',
        'Thành phố',
      ];
      district = `${getRandomElement(districtTypes)} ${getRandomElement(districtNames)}`;
    }

    const streetAddress = generateStreetAddress();
    const workPlace = getRandomElement(WORK_PLACES);
    const workAddress = `${workPlace}, ${district}, ${city}`;

    // Generate birth date and CCCD
    const birthDate = this.generateBirthDate(birthYear);
    const cccd = generateCCCD({
      gender: gender as 'Nam' | 'Nữ',
      birthYear: birthYear,
    });

    return {
      patient: {
        fullname,
        ethnicity: getRandomElement(VIETNAMESE_ETHNICITIES),
        marital_status: getRandomElement(MARITAL_STATUSES),
        address1: streetAddress,
        address2: `${district}, ${city}`,
        phone: generateVietnamesePhone(),
        gender,
        nation: 'Việt Nam',
        work_address: workAddress,
        allergies: getRandomElement(COMMON_ALLERGIES),
        personal_history: getRandomElement(PERSONAL_HISTORIES),
        family_history: getRandomElement(FAMILY_HISTORIES),
        citizen_id: cccd,
        date_of_birth: birthDate,
      },
    };
  }

  /**
   * Generate medical record using constants and combinations
   */
  private generateMedicalRecord(patient: any, doctor: DoctorInfo): any {
    const now = new Date();
    const startTime = new Date(now);
    startTime.setHours(
      9 + Math.floor(Math.random() * 2),
      Math.floor(Math.random() * 60),
      0,
      0,
    );

    const prescriptionTime = new Date(startTime);
    prescriptionTime.setMinutes(
      prescriptionTime.getMinutes() + 30 + Math.floor(Math.random() * 60),
    );

    // Generate lab tests (1-3 tests)
    const numTests = 1 + Math.floor(Math.random() * 3);
    const labTests = this.generateLabTests(numTests);

    // Generate prescription (1-3 medications)
    const numMedications = 1 + Math.floor(Math.random() * 3);
    const medications = this.generateMedications(numMedications);

    return {
      start_at: startTime.toISOString(),
      reason: getRandomElement(EXAMINATION_REASONS),
      current_status: getRandomElement(CURRENT_STATUSES),
      treatment: getRandomElement(TREATMENTS),
      diagnoses: getRandomElement(DIAGNOSES),
      lab_test: labTests,
      prescription: {
        issuedDate: prescriptionTime.toISOString(),
        notes: getRandomElement(PRESCRIPTION_NOTES),
        medications: medications,
      },
    };
  }

  /**
   * Generate lab tests with variety
   */
  private generateLabTests(count: number): any[] {
    const tests: any[] = [];
    const usedTests = new Set<string>();

    for (let i = 0; i < count; i++) {
      const testType = getRandomElement(LAB_TEST_TYPES);
      let testName: string;
      let availableTests: string[];

      if (testType === 'Xét nghiệm') {
        availableTests = BLOOD_TESTS.filter((test) => !usedTests.has(test));
        if (availableTests.length === 0) availableTests = BLOOD_TESTS;
        testName = getRandomElement(availableTests);
      } else {
        availableTests = IMAGING_TESTS.filter((test) => !usedTests.has(test));
        if (availableTests.length === 0) availableTests = IMAGING_TESTS;
        testName = getRandomElement(availableTests);
      }

      usedTests.add(testName);

      const test: any = {
        test_type: testType,
        test_name: testName,
        machine: getRandomElement(MEDICAL_MACHINES),
        taken_by: {
          id: uuidv4(),
          name: getRandomElement(TECHNICIAN_NAMES),
        },
        notes: getRandomElement(TEST_NOTES),
        conclusion: getRandomElement(TEST_CONCLUSIONS),
      };

      // Add results for blood tests
      if (testType === 'Xét nghiệm' && BLOOD_TEST_RESULTS[testName]) {
        test.results = this.generateTestResults(testName);
      }

      // Add file attachments for imaging tests
      if (testType === 'Chẩn đoán hình ảnh') {
        test.file_attachments = this.generateFileAttachments();
      }

      tests.push(test);
    }

    return tests;
  }

  /**
   * Generate test results with some variation
   */
  private generateTestResults(testName: string): any[] {
    const baseResults = BLOOD_TEST_RESULTS[testName];
    if (!baseResults) return [];

    return baseResults.map((result) => ({
      ...result,
      value: this.varyTestValue(result.value, result.reference_range),
    }));
  }

  /**
   * Vary test values slightly to create realistic variation
   */
  private varyTestValue(baseValue: string, referenceRange: string): string {
    const numValue = parseFloat(baseValue);
    if (isNaN(numValue)) return baseValue;

    // Add slight variation (±10%)
    const variation = (Math.random() - 0.5) * 0.2; // -10% to +10%
    const newValue = numValue * (1 + variation);

    // Keep appropriate decimal places
    const decimalPlaces = baseValue.includes('.')
      ? baseValue.split('.')[1].length
      : 0;
    return newValue.toFixed(decimalPlaces);
  }

  /**
   * Generate medications avoiding duplicates
   */
  private generateMedications(count: number): any[] {
    const availableMeds = [...MEDICATIONS];
    const selectedMeds: any[] = [];

    for (let i = 0; i < count && availableMeds.length > 0; i++) {
      const randomIndex = Math.floor(Math.random() * availableMeds.length);
      const medication = availableMeds.splice(randomIndex, 1)[0];
      selectedMeds.push({ ...medication });
    }

    return selectedMeds;
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
   * Fallback data generation when needed
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
