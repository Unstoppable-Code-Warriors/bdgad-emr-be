import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { ClickHouseService } from '../clickhouse/clickhouse.service';
import {
  GetPatientsQueryDto,
  PaginatedPatientsDto,
  PatientDetailDto,
  GetPatientDateCountsQueryDto,
  PaginatedPatientDateCountsDto,
} from './dto/patient.dto';

@Injectable()
export class PatientService {
  constructor(private readonly clickhouseService: ClickHouseService) {}

  async getPatientsByDoctor(
    doctorId: number,
    query: GetPatientsQueryDto,
  ): Promise<PaginatedPatientsDto> {
    const { page, limit, search, gender, sortBy, sortOrder } = query;
    const offset = (page - 1) * limit;

    // Build WHERE conditions (only for patient table, provider filtering is done in subquery)
    const conditions: string[] = [];
    const params: Record<string, any> = { doctorId };

    if (search) {
      conditions.push(
        '(p.FullName ILIKE {search:String} OR p.PatientSourceID ILIKE {search:String})',
      );
      params.search = `%${search}%`;
    }

    if (gender) {
      conditions.push('p.Gender = {gender:String}');
      params.gender = gender;
    }

    // Validate sortBy field
    const allowedSortFields = [
      'FullName',
      'DateOfBirth',
      'Gender',
      'PatientSourceID',
    ];
    const sortField = allowedSortFields.includes(sortBy) ? sortBy : 'FullName';

    // More efficient query - filter provider first, then join
    const baseQuery = `
      FROM DimPatient p
      WHERE p.IsCurrent = 1
      AND p.PatientKey IN (
        SELECT DISTINCT f.PatientKey
        FROM FactGeneticTestResult f
        JOIN DimProvider pr ON f.ProviderKey = pr.ProviderKey
        WHERE pr.DoctorId = {doctorId:UInt32}
        LIMIT 10000
      )
      ${conditions.length > 0 ? `AND (${conditions.join(' AND ')})` : ''}
    `;

    // Get total count with limit to prevent memory issues
    const countQuery = `
      SELECT COUNT(*) as total
      FROM (
        SELECT p.PatientKey
        ${baseQuery}
        LIMIT 50000
      ) subquery
    `;
    const countResult = await this.clickhouseService.query(countQuery, params);
    const total = Number((countResult?.data?.[0] as any)?.total) || 0;

    // Get paginated data with optimized query
    const dataQuery = `
      SELECT
        p.PatientKey,
        p.PatientSourceID,
        p.FullName,
        p.DateOfBirth,
        p.Gender,
        p.Address,
        p.Barcode
      ${baseQuery}
      ORDER BY p.${sortField} ${sortOrder}
      LIMIT {limit:UInt32} OFFSET {offset:UInt32}
    `;

    params.limit = limit;
    params.offset = offset;

    const patientsResult = await this.clickhouseService.query(
      dataQuery,
      params,
    );
    const patientsArray = Array.isArray(patientsResult?.data)
      ? patientsResult.data
      : [];

    return {
      data: patientsArray.map((patient: ClickHousePatientResult) => ({
        PatientKey: Number(patient.PatientKey),
        PatientSourceID: String(patient.PatientSourceID),
        FullName: String(patient.FullName),
        DateOfBirth: patient.DateOfBirth
          ? String(patient.DateOfBirth)
          : undefined,
        Gender: patient.Gender ? String(patient.Gender) : undefined,
        Address: patient.Address ? String(patient.Address) : undefined,
        Barcode: String(patient.Barcode),
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getPatientByIdForDoctor(
    doctorId: number,
    patientKey: number,
  ): Promise<PatientDetailDto> {
    // First, verify that the doctor has access to this patient (optimized)
    const accessQuery = `
      SELECT 1 as hasAccess
      FROM DimPatient p
      WHERE p.PatientKey = {patientKey:UInt64}
        AND p.IsCurrent = true
        AND p.PatientKey IN (
          SELECT DISTINCT f.PatientKey
          FROM FactGeneticTestResult f
          JOIN DimProvider pr ON f.ProviderKey = pr.ProviderKey
          WHERE pr.DoctorId = {doctorId:UInt32}
          LIMIT 1
        )
      LIMIT 1
    `;

    const accessResult = await this.clickhouseService.query(accessQuery, {
      patientKey,
      doctorId,
    });
    const accessArray = Array.isArray(accessResult?.data)
      ? accessResult.data
      : [];

    if (
      !(accessArray[0] as any)?.hasAccess ||
      Number((accessArray[0] as any).hasAccess) === 0
    ) {
      throw new ForbiddenException(
        'You do not have access to this patient or patient does not exist',
      );
    }

    // Get patient details
    const patientQuery = `
      SELECT DISTINCT
        p.PatientKey,
        p.PatientSourceID,
        p.FullName,
        p.DateOfBirth,
        p.Gender,
        p.Address,
        p.Barcode
      FROM DimPatient p
      WHERE p.PatientKey = {patientKey:UInt64} AND p.IsCurrent = true
    `;

    const patientResult = await this.clickhouseService.query(patientQuery, {
      patientKey,
    });
    const patientArray = Array.isArray(patientResult?.data)
      ? patientResult.data
      : [];

    if (!patientArray.length) {
      throw new NotFoundException('Patient not found');
    }

    const patient = patientArray[0] as ClickHousePatientResult;

    // Get recent tests for this patient (performed by any doctor this doctor has access to)
    const testsQuery = `
      SELECT
        t.TestName,
        f.DateReceived,
        t.TestCategory
      FROM FactGeneticTestResult f
      JOIN DimTest t ON f.TestKey = t.TestKey
      JOIN DimProvider pr ON f.ProviderKey = pr.ProviderKey
      WHERE f.PatientKey = {patientKey:UInt64}
        AND pr.DoctorId = {doctorId:UInt32}
      ORDER BY f.DateReceived DESC
      LIMIT 10
    `;

    const recentTests = await this.clickhouseService.query(testsQuery, {
      patientKey,
      doctorId,
    });
    const testsArray = Array.isArray(recentTests?.data) ? recentTests.data : [];

    return {
      PatientKey: Number(patient.PatientKey),
      PatientSourceID: String(patient.PatientSourceID),
      FullName: String(patient.FullName),
      DateOfBirth: patient.DateOfBirth
        ? String(patient.DateOfBirth)
        : undefined,
      Gender: patient.Gender ? String(patient.Gender) : undefined,
      Address: patient.Address ? String(patient.Address) : undefined,
      Barcode: String(patient.Barcode),
      recentTests: testsArray.map((test: ClickHouseTestResult) => ({
        TestName: String(test.TestName),
        DateReceived: String(test.DateReceived),
        TestCategory: String(test.TestCategory),
      })),
    };
  }

  async getPatientDateCounts(
    doctorId: number,
    query: GetPatientDateCountsQueryDto,
  ): Promise<PaginatedPatientDateCountsDto> {
    const { type, page, limit } = query;
    const offset = (page - 1) * limit;

    // Define date format and grouping based on type
    let dateFormat: string;

    switch (type) {
      case 'day':
        dateFormat = '%Y-%m-%d';
        break;
      case 'month':
        dateFormat = '%Y-%m';
        break;
      case 'year':
        dateFormat = '%Y';
        break;
      default:
        throw new Error('Invalid date type');
    }

    // Count total distinct periods
    const countQuery = `
      SELECT COUNT(DISTINCT formatDateTime(f.DateReceived, {dateFormat:String})) as total
      FROM FactGeneticTestResult f
      JOIN DimProvider pr ON f.ProviderKey = pr.ProviderKey
      WHERE pr.DoctorId = {doctorId:UInt32}
        AND f.DateReceived IS NOT NULL
    `;

    const countResult = await this.clickhouseService.query(countQuery, {
      doctorId,
      dateFormat,
    });
    const total = Number((countResult?.data?.[0] as any)?.total) || 0;

    // Get paginated date counts
    const dataQuery = `
      SELECT 
        formatDateTime(f.DateReceived, {dateFormat:String}) as date_period,
        COUNT(DISTINCT f.PatientKey) as patient_count,
        MIN(f.DateReceived) as period_start,
        MAX(f.DateReceived) as period_end
      FROM FactGeneticTestResult f
      JOIN DimProvider pr ON f.ProviderKey = pr.ProviderKey
      WHERE pr.DoctorId = {doctorId:UInt32}
        AND f.DateReceived IS NOT NULL
      GROUP BY formatDateTime(f.DateReceived, {dateFormat:String})
      ORDER BY date_period DESC
      LIMIT {limit:UInt32} OFFSET {offset:UInt32}
    `;

    const dataResult = await this.clickhouseService.query(dataQuery, {
      doctorId,
      dateFormat,
      limit,
      offset,
    });
    const dataArray = Array.isArray(dataResult?.data) ? dataResult.data : [];

    // Format the results
    const formattedData = dataArray.map((row: any) => {
      const period = String(row.date_period);
      let label: string;
      let startDate: string;
      let endDate: string;

      if (type === 'day') {
        // Format: "2025-01-15" -> "15/01/2025"
        const [year, month, day] = period.split('-');
        label = `${day}/${month}/${year}`;
        startDate = `${period}T00:00:00.000Z`;
        endDate = `${period}T23:59:59.999Z`;
      } else if (type === 'month') {
        // Format: "2025-01" -> "Tháng 1/2025"
        const [year, month] = period.split('-');
        label = `Tháng ${parseInt(month)}/${year}`;
        startDate = `${period}-01T00:00:00.000Z`;
        // Get last day of month
        const lastDay = new Date(parseInt(year), parseInt(month), 0).getDate();
        endDate = `${period}-${lastDay.toString().padStart(2, '0')}T23:59:59.999Z`;
      } else {
        // Format: "2025" -> "Năm 2025"
        label = `Năm ${period}`;
        startDate = `${period}-01-01T00:00:00.000Z`;
        endDate = `${period}-12-31T23:59:59.999Z`;
      }

      return {
        period,
        label,
        count: Number(row.patient_count),
        startDate,
        endDate,
      };
    });

    return {
      data: formattedData,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
      type,
    };
  }
}

// Add interface for ClickHouse patient result
interface ClickHousePatientResult {
  PatientKey: number;
  PatientSourceID: string;
  FullName: string;
  DateOfBirth?: string;
  Gender?: string;
  Address?: string;
  Barcode: string;
}

// Add interface for ClickHouse test result
interface ClickHouseTestResult {
  TestName: string;
  DateReceived: string;
  TestCategory: string;
}
