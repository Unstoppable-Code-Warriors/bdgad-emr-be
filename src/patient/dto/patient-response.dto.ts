export interface PatientExtendedInfo {
  pattern: string;
  data: {
    appointment?: {
      id: string;
      date: string;
    };
    patient?: {
      fullname: string;
      ethnicity?: string;
      marital_status?: string;
      address1?: string;
      address2?: string;
      phone?: string;
      gender?: string;
      nation?: string;
      work_address?: string;
      allergies?: string;
      personal_history?: string;
      family_history?: string;
      citizen_id?: string;
      date_of_birth?: string;
    };
    medical_record?: {
      start_at?: string;
      reason?: string;
      current_status?: string;
      treatment?: string;
      diagnoses?: string;
      lab_test?: Array<{
        test_type: string;
        test_name: string;
        machine?: string;
        taken_by?: {
          id: number;
          name: string;
        };
        notes?: string;
        conclusion?: string;
        file_attachments?: Array<{
          filename: string;
          url: string;
          file_type: string;
          file_size: number;
        }>;
      }>;
      prescription?: {
        issuedDate: string;
        notes?: string;
        medications?: Array<{
          name: string;
          dosage: string;
          route: string;
          frequency: string;
          duration: string;
          instruction: string;
          quantity: number;
        }>;
      };
      doctor?: {
        id: number;
        email?: string;
        name: string;
        phone?: string;
        address?: string;
      };
      s3_file_attachment_urls?: string[];
    };
  };
}

export interface PatientSummary {
  patientKey: number;
  fullName: string;
  dateOfBirth: string | null;
  gender: string | null;
  barcode: string;
  address: string | null;
  citizenID: string;
  lastTestDate: string;
  totalTests: number;
  doctorName: string;
}

export interface PatientDetails extends PatientSummary {
  patientSourceId: string;
  citizenId: string;
  extendedInfo: PatientExtendedInfo | null; // Structured JSON object
  recentTests: TestResult[];
  testHistory: TestHistoryItem[];
}

export interface TestResult {
  testKey: number;
  testName: string;
  testCategory: string;
  dateReceived: string;
  dateReported: string;
  diagnosis: string | null;
  variantName: string | null;
  clinicalSignificance: string | null;
  location: string | null; // 'pharmacy' or 'bdgad'
  resultEtlUrl: string | null; // URL kết quả ETL từ DimTestRun
  ehrUrl: any; // EHR URL từ DimTestRun - parsed JSON (array hoặc object)
}

export interface TestHistoryItem {
  testKey: number;
  testName: string;
  dateReceived: string;
  doctorName: string;
  clinicName: string;
  status: 'completed' | 'pending' | 'cancelled';
  location: string | null; // 'pharmacy' or 'bdgad'
  resultEtlUrl: string | null; // URL kết quả ETL từ DimTestRun
  ehrUrl: any; // EHR URL từ DimTestRun - parsed JSON (array hoặc object)
}

export interface PatientSearchResponse {
  data: PatientSummary[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

export interface DashboardStats {
  totalPatients: number;
  totalTestsToday: number;
  totalTestsThisWeek: number;
  totalTestsThisMonth: number;
  testsByType: Array<{
    testCategory: string;
    count: number;
  }>;
  patientsByPeriod: Array<{
    date: string;
    count: number;
  }>;
  topDiagnoses: Array<{
    diagnosis: string;
    count: number;
  }>;
}

export interface PatientMonthlyStats {
  month: number;
  total: number;
}

export interface PatientYearlyStats {
  year: number;
  total: number;
  months: PatientMonthlyStats[];
}

export interface PatientByMonthYearResponse {
  data: PatientYearlyStats[];
}
