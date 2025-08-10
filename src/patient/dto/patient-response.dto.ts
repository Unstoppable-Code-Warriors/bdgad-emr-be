export interface PatientSummary {
  patientKey: number;
  fullName: string;
  dateOfBirth: string | null;
  gender: string | null;
  barcode: string;
  address: string | null;
  lastTestDate: string;
  totalTests: number;
  doctorName: string;
}

export interface PatientDetails extends PatientSummary {
  patientSourceId: string;
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
