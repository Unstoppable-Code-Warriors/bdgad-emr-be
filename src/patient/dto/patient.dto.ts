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
