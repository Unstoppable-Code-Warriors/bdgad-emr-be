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

    // Build WHERE conditions
    const conditions = [
      'pr.DoctorId = {doctorId:UInt32}',
      'p.IsCurrent = true',
    ];
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

    // Build the main query
    const whereClause =
      conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const baseQuery = `
      FROM DimPatient p
      JOIN (
        SELECT DISTINCT PatientKey, ProviderKey
        FROM FactGeneticTestResult
      ) f ON p.PatientKey = f.PatientKey
      JOIN DimProvider pr ON f.ProviderKey = pr.ProviderKey
      ${whereClause}
    `;

    // Get total count
    const countQuery = `SELECT COUNT(DISTINCT p.PatientKey) as total ${baseQuery}`;
    const countResult = await this.clickhouseService.query(countQuery, params);
    const total = Number(countResult[0]?.total) || 0;

    // Get paginated data
    const dataQuery = `
      SELECT DISTINCT
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

    const patients = await this.clickhouseService.query(dataQuery, params);
    const patientsArray = Array.isArray(patients) ? patients : [];

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
    // First, verify that the doctor has access to this patient
    const accessQuery = `
      SELECT COUNT(*) as hasAccess
      FROM DimPatient p
      JOIN FactGeneticTestResult f ON p.PatientKey = f.PatientKey
      JOIN DimProvider pr ON f.ProviderKey = pr.ProviderKey
      WHERE p.PatientKey = {patientKey:UInt64}
        AND pr.DoctorId = {doctorId:UInt32}
        AND p.IsCurrent = true
    `;

    const accessResult = await this.clickhouseService.query(accessQuery, {
      patientKey,
      doctorId,
    });
    const accessArray = Array.isArray(accessResult) ? accessResult : [];

    if (!accessArray[0]?.hasAccess || Number(accessArray[0].hasAccess) === 0) {
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
    const patientArray = Array.isArray(patientResult) ? patientResult : [];

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
    const testsArray = Array.isArray(recentTests) ? recentTests : [];

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
