import { Injectable, NotFoundException } from '@nestjs/common';
import { ClickHouseService } from '../clickhouse/clickhouse.service';
import { PatientSearchDto } from './dto/patient-search.dto';
import { DashboardStatsDto } from './dto/dashboard-stats.dto';
import {
  PatientSummary,
  PatientDetails,
  PatientSearchResponse,
  DashboardStats,
  TestResult,
} from './dto/patient-response.dto';

interface ClickHouseQueryResult {
  data: any[];
}

interface CountResult {
  total: number;
}

interface OwnershipResult {
  count: number;
}

interface PeriodStatsResult {
  totalToday: number;
  totalThisWeek: number;
  totalThisMonth: number;
}

@Injectable()
export class PatientService {
  constructor(private readonly clickhouseService: ClickHouseService) {}

  async searchPatients(
    doctorId: number,
    searchDto: PatientSearchDto,
  ): Promise<PatientSearchResponse> {
    const {
      page = 1,
      limit = 20,
      sortBy = 'lastTestDate',
      sortOrder = 'DESC',
    } = searchDto;
    const offset = (page - 1) * limit;

    // Build WHERE conditions for filtering patients
    const filterConditions = ['pr.DoctorId = {doctorId:UInt32}'];
    const queryParams: Record<string, any> = { doctorId };

    if (searchDto.name) {
      filterConditions.push('p.FullName ILIKE {name:String}');
      queryParams.name = `%${searchDto.name}%`;
    }

    if (searchDto.barcode) {
      filterConditions.push('p.Barcode = {barcode:String}');
      queryParams.barcode = searchDto.barcode;
    }

    if (searchDto.dateFrom) {
      filterConditions.push('f.DateReceived >= {dateFrom:DateTime}');
      queryParams.dateFrom = searchDto.dateFrom;
    }

    if (searchDto.dateTo) {
      filterConditions.push('f.DateReceived <= {dateTo:DateTime}');
      queryParams.dateTo = searchDto.dateTo;
    }

    if (searchDto.testType) {
      filterConditions.push('t.TestCategory = {testType:String}');
      queryParams.testType = searchDto.testType;
    }

    if (searchDto.diagnosis) {
      filterConditions.push('d.DiagnosisDescription ILIKE {diagnosis:String}');
      queryParams.diagnosis = `%${searchDto.diagnosis}%`;
    }

    const filterWhereClause = filterConditions.join(' AND ');

    // Build ORDER BY clause
    let orderByClause = '';
    switch (sortBy) {
      case 'lastTestDate':
        orderByClause = `lastTestDate ${sortOrder}`;
        break;
      case 'name':
        orderByClause = `p.FullName ${sortOrder}`;
        break;
      case 'dateOfBirth':
        orderByClause = `p.DateOfBirth ${sortOrder}`;
        break;
      default:
        orderByClause = `lastTestDate ${sortOrder}`;
    }

    // Main query to get patients
    // Use CTE to first filter patients that match criteria, then get all their test data
    const searchQuery = `
      WITH filtered_patients AS (
        SELECT DISTINCT f.PatientKey as PatientKey
        FROM FactGeneticTestResult f
        JOIN DimPatient p ON f.PatientKey = p.PatientKey AND p.IsCurrent = true
        JOIN DimProvider pr ON f.ProviderKey = pr.ProviderKey
        LEFT JOIN DimTest t ON f.TestKey = t.TestKey
        LEFT JOIN DimDiagnosis d ON f.DiagnosisKey = d.DiagnosisKey
        WHERE ${filterWhereClause}
      )
      SELECT DISTINCT
        p.PatientKey as patientKey,
        p.FullName as fullName,
        p.DateOfBirth as dateOfBirth,
        p.Gender as gender,
        p.Barcode as barcode,
        p.Address as address,
        MAX(f_all.DateReceived) as lastTestDate,
        COUNT(f_all.TestKey) as totalTests,
        pr.DoctorName as doctorName
      FROM filtered_patients fp
      JOIN FactGeneticTestResult f_all ON fp.PatientKey = f_all.PatientKey
      JOIN DimPatient p ON f_all.PatientKey = p.PatientKey AND p.IsCurrent = true
      JOIN DimProvider pr ON f_all.ProviderKey = pr.ProviderKey
      WHERE pr.DoctorId = {doctorId:UInt32}
      GROUP BY 
        p.PatientKey, p.FullName, p.DateOfBirth, p.Gender, 
        p.Barcode, p.Address, pr.DoctorName
      ORDER BY ${orderByClause}
      LIMIT {limit:UInt32} OFFSET {offset:UInt32}
    `;

    // Count query for pagination
    const countQuery = `
      SELECT COUNT(DISTINCT p.PatientKey) as total
      FROM FactGeneticTestResult f
      JOIN DimPatient p ON f.PatientKey = p.PatientKey AND p.IsCurrent = true
      JOIN DimProvider pr ON f.ProviderKey = pr.ProviderKey
      LEFT JOIN DimTest t ON f.TestKey = t.TestKey
      LEFT JOIN DimDiagnosis d ON f.DiagnosisKey = d.DiagnosisKey
      WHERE ${filterWhereClause}
    `;

    queryParams.limit = limit;
    queryParams.offset = offset;

    try {
      const [searchResult, countResult] = await Promise.all([
        this.clickhouseService.query(
          searchQuery,
          queryParams,
        ) as Promise<ClickHouseQueryResult>,
        this.clickhouseService.query(
          countQuery,
          queryParams,
        ) as Promise<ClickHouseQueryResult>,
      ]);

      const patients = searchResult.data as PatientSummary[];
      const total = (countResult.data[0] as CountResult)?.total || 0;
      const totalPages = Math.ceil(total / limit);

      return {
        data: patients,
        pagination: {
          page,
          limit,
          total,
          totalPages,
          hasNext: page < totalPages,
          hasPrev: page > 1,
        },
      };
    } catch (error) {
      console.error('Error searching patients:', error);
      throw error;
    }
  }

  async getPatientDetails(
    patientKey: number,
    doctorId: number,
  ): Promise<PatientDetails> {
    // Verify patient belongs to this doctor
    const ownershipQuery = `
      SELECT COUNT(*) as count
      FROM FactGeneticTestResult f
      JOIN DimProvider pr ON f.ProviderKey = pr.ProviderKey
      WHERE f.PatientKey = {patientKey:UInt64} AND pr.DoctorId = {doctorId:UInt32}
    `;

    const ownershipResult = (await this.clickhouseService.query(
      ownershipQuery,
      {
        patientKey,
        doctorId,
      },
    )) as ClickHouseQueryResult;

    if ((ownershipResult.data[0] as OwnershipResult)?.count === 0) {
      throw new NotFoundException('Patient not found or access denied');
    }

    // Get patient basic info
    const patientQuery = `
      SELECT DISTINCT
        p.PatientKey as patientKey,
        p.PatientSourceID as patientSourceId,
        p.FullName as fullName,
        p.DateOfBirth as dateOfBirth,
        p.Gender as gender,
        p.Barcode as barcode,
        p.Address as address,
        MAX(f.DateReceived) as lastTestDate,
        COUNT(f.TestKey) as totalTests,
        pr.DoctorName as doctorName
      FROM FactGeneticTestResult f
      JOIN DimPatient p ON f.PatientKey = p.PatientKey AND p.IsCurrent = true
      JOIN DimProvider pr ON f.ProviderKey = pr.ProviderKey
      WHERE p.PatientKey = {patientKey:UInt64} AND pr.DoctorId = {doctorId:UInt32}
      GROUP BY 
        p.PatientKey, p.PatientSourceID, p.FullName, p.DateOfBirth, 
        p.Gender, p.Barcode, p.Address, pr.DoctorName
    `;

    // Get recent test results (last 5)
    const recentTestsQuery = `
      SELECT
        f.TestKey as testKey,
        t.TestName as testName,
        t.TestCategory as testCategory,
        f.DateReceived as dateReceived,
        dd.FullDate as dateReported,
        d.DiagnosisDescription as diagnosis,
        v.VariantName as variantName,
        v.ClinicalSignificance as clinicalSignificance
      FROM FactGeneticTestResult f
      LEFT JOIN DimTest t ON f.TestKey = t.TestKey
      LEFT JOIN DimDate dd ON f.DateReportedKey = dd.DateKey
      LEFT JOIN DimDiagnosis d ON f.DiagnosisKey = d.DiagnosisKey
      LEFT JOIN DimVariant v ON f.VariantKey = v.VariantKey
      JOIN DimProvider pr ON f.ProviderKey = pr.ProviderKey
      WHERE f.PatientKey = {patientKey:UInt64} AND pr.DoctorId = {doctorId:UInt32}
      ORDER BY f.DateReceived DESC
      LIMIT 5
    `;

    try {
      const [patientResult, recentTestsResult] = await Promise.all([
        this.clickhouseService.query(patientQuery, {
          patientKey,
          doctorId,
        }) as Promise<ClickHouseQueryResult>,
        this.clickhouseService.query(recentTestsQuery, {
          patientKey,
          doctorId,
        }) as Promise<ClickHouseQueryResult>,
      ]);

      const patientData = patientResult.data[0] as PatientSummary & {
        patientSourceId: string;
      };
      if (!patientData) {
        throw new NotFoundException('Patient not found');
      }

      const recentTests = recentTestsResult.data as TestResult[];

      return {
        ...patientData,
        recentTests,
        testHistory: [], // Will be loaded separately if needed
      };
    } catch (error) {
      console.error('Error getting patient details:', error);
      throw error;
    }
  }

  async getPatientTestHistory(patientKey: number, doctorId: number) {
    // Verify ownership first
    const ownershipQuery = `
      SELECT COUNT(*) as count
      FROM FactGeneticTestResult f
      JOIN DimProvider pr ON f.ProviderKey = pr.ProviderKey
      WHERE f.PatientKey = {patientKey:UInt64} AND pr.DoctorId = {doctorId:UInt32}
    `;

    const ownershipResult = (await this.clickhouseService.query(
      ownershipQuery,
      {
        patientKey,
        doctorId,
      },
    )) as ClickHouseQueryResult;

    if ((ownershipResult.data[0] as OwnershipResult)?.count === 0) {
      throw new NotFoundException('Patient not found or access denied');
    }

    const historyQuery = `
      SELECT
        f.TestKey as testKey,
        t.TestName as testName,
        f.DateReceived as dateReceived,
        pr.DoctorName as doctorName,
        pr.ClinicName as clinicName,
        'completed' as status
      FROM FactGeneticTestResult f
      LEFT JOIN DimTest t ON f.TestKey = t.TestKey
      JOIN DimProvider pr ON f.ProviderKey = pr.ProviderKey
      WHERE f.PatientKey = {patientKey:UInt64} AND pr.DoctorId = {doctorId:UInt32}
      ORDER BY f.DateReceived DESC
    `;

    try {
      const result = (await this.clickhouseService.query(historyQuery, {
        patientKey,
        doctorId,
      })) as ClickHouseQueryResult;

      return result.data;
    } catch (error) {
      console.error('Error getting patient test history:', error);
      throw error;
    }
  }

  async getDashboardStats(
    doctorId: number,
    statsDto: DashboardStatsDto,
  ): Promise<DashboardStats> {
    const { period = 'week' } = statsDto;

    // Get date range based on period
    let dateCondition = '';
    switch (period) {
      case 'day':
        dateCondition = 'f.DateReceived >= today()';
        break;
      case 'week':
        dateCondition = 'f.DateReceived >= date_sub(WEEK, 1, now())';
        break;
      case 'month':
        dateCondition = 'f.DateReceived >= date_sub(MONTH, 1, now())';
        break;
      case 'year':
        dateCondition = 'f.DateReceived >= date_sub(YEAR, 1, now())';
        break;
    }

    // Total patients
    const totalPatientsQuery = `
      SELECT COUNT(DISTINCT f.PatientKey) as total
      FROM FactGeneticTestResult f
      JOIN DimProvider pr ON f.ProviderKey = pr.ProviderKey
      WHERE pr.DoctorId = {doctorId:UInt32}
    `;

    // Tests by period
    const testsByPeriodQuery = `
      SELECT 
        COUNT(*) as totalToday,
        COUNT(CASE WHEN f.DateReceived >= date_sub(WEEK, 1, now()) THEN 1 END) as totalThisWeek,
        COUNT(CASE WHEN f.DateReceived >= date_sub(MONTH, 1, now()) THEN 1 END) as totalThisMonth
      FROM FactGeneticTestResult f
      JOIN DimProvider pr ON f.ProviderKey = pr.ProviderKey
      WHERE pr.DoctorId = {doctorId:UInt32} AND f.DateReceived >= today()
    `;

    // Tests by type
    const testsByTypeQuery = `
      SELECT 
        t.TestCategory as testCategory,
        COUNT(*) as count
      FROM FactGeneticTestResult f
      JOIN DimProvider pr ON f.ProviderKey = pr.ProviderKey
      LEFT JOIN DimTest t ON f.TestKey = t.TestKey
      WHERE pr.DoctorId = {doctorId:UInt32} AND ${dateCondition}
      GROUP BY t.TestCategory
      ORDER BY count DESC
      LIMIT 10
    `;

    // Top diagnoses
    const topDiagnosesQuery = `
      SELECT 
        d.DiagnosisDescription as diagnosis,
        COUNT(*) as count
      FROM FactGeneticTestResult f
      JOIN DimProvider pr ON f.ProviderKey = pr.ProviderKey
      LEFT JOIN DimDiagnosis d ON f.DiagnosisKey = d.DiagnosisKey
      WHERE pr.DoctorId = {doctorId:UInt32} AND ${dateCondition}
        AND d.DiagnosisDescription IS NOT NULL
      GROUP BY d.DiagnosisDescription
      ORDER BY count DESC
      LIMIT 10
    `;

    try {
      const [totalResult, periodResult, typeResult, diagnosisResult] =
        await Promise.all([
          this.clickhouseService.query(totalPatientsQuery, {
            doctorId,
          }) as Promise<ClickHouseQueryResult>,
          this.clickhouseService.query(testsByPeriodQuery, {
            doctorId,
          }) as Promise<ClickHouseQueryResult>,
          this.clickhouseService.query(testsByTypeQuery, {
            doctorId,
          }) as Promise<ClickHouseQueryResult>,
          this.clickhouseService.query(topDiagnosesQuery, {
            doctorId,
          }) as Promise<ClickHouseQueryResult>,
        ]);

      const periodData = (periodResult.data[0] as PeriodStatsResult) || {};

      return {
        totalPatients: (totalResult.data[0] as CountResult)?.total || 0,
        totalTestsToday: periodData.totalToday || 0,
        totalTestsThisWeek: periodData.totalThisWeek || 0,
        totalTestsThisMonth: periodData.totalThisMonth || 0,
        testsByType:
          (typeResult.data as Array<{ testCategory: string; count: number }>) ||
          [],
        patientsByPeriod: [], // Can be implemented later if needed
        topDiagnoses:
          (diagnosisResult.data as Array<{
            diagnosis: string;
            count: number;
          }>) || [],
      };
    } catch (error) {
      console.error('Error getting dashboard stats:', error);
      throw error;
    }
  }
}
