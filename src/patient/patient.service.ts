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
    console.log('🔍 [PatientService] Executing count query:', countQuery);
    console.log('🔍 [PatientService] With params:', params);
    const countResult = await this.clickhouseService.query(countQuery, params);
    const total = Number((countResult?.data?.[0] as any)?.total) || 0;

    console.log('📊 [PatientService] Count query result:', {
      total,
      countResultType: typeof countResult,
    });

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

    console.log(
      '🔍 [PatientService] Executing optimized patient query for doctor:',
      doctorId,
    );
    console.log('🔍 [PatientService] Query params:', {
      page,
      limit,
      search,
      gender,
      sortBy,
      sortOrder,
    });

    console.log('🔍 [PatientService] Executing data query:', dataQuery);
    console.log('🔍 [PatientService] With params:', params);
    const patientsResult = await this.clickhouseService.query(
      dataQuery,
      params,
    );
    const patientsArray = Array.isArray(patientsResult?.data)
      ? patientsResult.data
      : [];

    console.log('✅ [PatientService] Query executed successfully. Results:', {
      rawPatientsType: typeof patientsResult,
      hasDataProperty: 'data' in (patientsResult || {}),
      dataType: typeof patientsResult?.data,
      isDataArray: Array.isArray(patientsResult?.data),
      patientsArrayLength: patientsArray.length,
      firstPatient:
        patientsArray.length > 0
          ? (patientsArray[0] as ClickHousePatientResult)
          : 'No patients found',
    });

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
