export class BdgadTestSummaryDto {
  testRunKey: number;
  date: string;
  totalFiles: number;
  caseId: string;
}

export class BdgadTestDetailsDto {
  testRunKey: number;
  date: string;
  patient: {
    citizenId: string;
    name: string;
    dateOfBirth?: string;
    gender?: string;
    address?: string;
  };
  labCodes: any[];
}

export class BdgadTestListResponse {
  data: BdgadTestSummaryDto[];
  total: number;
} 