export class TestResultSummaryDto {
  testRunKey: number;
  date: string;
  totalFiles: number;
}

export class TestResultDetailsDto {
  testRunKey: number;
  date: string;
  ehrUrls: string[];
  patient: {
    citizenId: string;
    name: string;
    dateOfBirth?: string;
    gender?: string;
    address?: string;
    barcode?: string;
  };
}

export class TestResultListResponse {
  data: TestResultSummaryDto[];
  total: number;
} 