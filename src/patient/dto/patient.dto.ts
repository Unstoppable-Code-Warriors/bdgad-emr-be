export interface GetPatientsQueryDto {
  page: number;
  limit: number;
  search?: string;
  gender?: string;
  sortBy: string;
  sortOrder: 'ASC' | 'DESC';
}

export interface PatientDto {
  PatientKey: number;
  PatientSourceID: string;
  FullName: string;
  DateOfBirth?: string;
  Gender?: string;
  Address?: string;
  Barcode: string;
}

export interface PaginatedPatientsDto {
  data: PatientDto[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface PatientDetailDto extends PatientDto {
  recentTests?: {
    TestName: string;
    DateReceived: string;
    TestCategory: string;
  }[];
}

export interface GetPatientDateCountsQueryDto {
  type: 'day' | 'month' | 'year';
  page: number;
  limit: number;
}

export interface PatientDateCountDto {
  period: string; // Format: "2025-01", "2025-01-15", "2025"
  label: string; // Human readable: "Tháng 1/2025", "15/01/2025", "Năm 2025"
  count: number;
  startDate: string; // ISO date string
  endDate: string; // ISO date string
}

export interface PaginatedPatientDateCountsDto {
  data: PatientDateCountDto[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
  type: 'day' | 'month' | 'year';
}
