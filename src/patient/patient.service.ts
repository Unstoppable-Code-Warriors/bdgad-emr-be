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
  TestHistoryItem,
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
    console.log('=== PatientService.searchPatients START ===');
    console.log('Input parameters:', {
      doctorId,
      searchDto: JSON.stringify(searchDto),
    });

    const {
      page = 1,
      limit = 20,
      sortBy = 'lastTestDate',
      sortOrder = 'DESC',
    } = searchDto;
    const offset = (page - 1) * limit;

    console.log('Pagination settings:', {
      page,
      limit,
      offset,
      sortBy,
      sortOrder,
    });

    // Build WHERE conditions for filtering
    const filterConditions: string[] = [];
    const queryParams: Record<string, any> = { doctorId };

    console.log('Building filter conditions...');

    if (searchDto.name) {
      filterConditions.push('p.FullName ILIKE {name:String}');
      queryParams.name = `%${searchDto.name}%`;
      console.log('Added name filter:', queryParams.name);
    }

    if (searchDto.barcode) {
      filterConditions.push('p.Barcode = {barcode:String}');
      queryParams.barcode = searchDto.barcode;
      console.log('Added barcode filter:', queryParams.barcode);
    }

    if (searchDto.dateFrom) {
      try {
        // Ensure date is in correct format for ClickHouse
        const dateFrom = new Date(searchDto.dateFrom)
          .toISOString()
          .split('T')[0];
        filterConditions.push('f.DateReceived >= {dateFrom:Date}');
        queryParams.dateFrom = dateFrom;
        console.log('Added dateFrom filter:', queryParams.dateFrom);
      } catch (error) {
        console.error('Invalid dateFrom format:', searchDto.dateFrom);
        throw new Error(`Invalid dateFrom format: ${searchDto.dateFrom}`);
      }
    }

    if (searchDto.dateTo) {
      try {
        // Ensure date is in correct format for ClickHouse
        const dateTo = new Date(searchDto.dateTo).toISOString().split('T')[0];
        filterConditions.push('f.DateReceived <= {dateTo:Date}');
        queryParams.dateTo = dateTo;
        console.log('Added dateTo filter:', queryParams.dateTo);
      } catch (error) {
        console.error('Invalid dateTo format:', searchDto.dateTo);
        throw new Error(`Invalid dateTo format: ${searchDto.dateTo}`);
      }
    }

    if (searchDto.testType) {
      filterConditions.push('t.TestCategory = {testType:String}');
      queryParams.testType = searchDto.testType;
      console.log('Added testType filter:', queryParams.testType);
    }

    if (searchDto.diagnosis) {
      filterConditions.push('d.DiagnosisDescription ILIKE {diagnosis:String}');
      queryParams.diagnosis = `%${searchDto.diagnosis}%`;
      console.log('Added diagnosis filter:', queryParams.diagnosis);
    }

    // Handle month filter - this will be applied to patient StartDate, separate from test date filters
    let monthFilter = '';
    if (searchDto.month) {
      try {
        // Validate month format (YYYY-MM)
        const monthMatch = searchDto.month.match(/^(\d{4})-(\d{2})$/);
        if (!monthMatch) {
          throw new Error('Invalid month format. Expected YYYY-MM');
        }

        const [, year, month] = monthMatch;
        const monthNumber = parseInt(month, 10);

        if (monthNumber < 1 || monthNumber > 12) {
          throw new Error('Invalid month. Must be between 01 and 12');
        }

        queryParams.monthYear = year;
        queryParams.monthNum = monthNumber;
        console.log('Added month filter:', { year, month: monthNumber });
      } catch (error) {
        console.error('Invalid month format:', searchDto.month);
        throw error; // Re-throw the original error to preserve specific error messages
      }
    }

    // Build additional filter WHERE clause
    const additionalFilters =
      filterConditions.length > 0
        ? `AND ${filterConditions.join(' AND ')}`
        : '';

    console.log('Additional filters:', additionalFilters);
    console.log('Query parameters:', JSON.stringify(queryParams));

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

    console.log('Order by clause:', orderByClause);

    // Main query: Get patients with filtering applied in a single pass
    const searchQuery = `
      WITH latest_patient_data AS (
        SELECT PatientKey, FullName, DateOfBirth, Gender, Barcode, Address,
               ROW_NUMBER() OVER (PARTITION BY PatientKey ORDER BY EndDate DESC) as rn
        FROM DimPatient
        ${searchDto.month ? `WHERE toYear(StartDate) = {monthYear:UInt32} AND toMonth(StartDate) = {monthNum:UInt32}` : ''}
      ),
      filtered_tests AS (
        SELECT DISTINCT
          f.PatientKey,
          pr.DoctorName
        FROM FactGeneticTestResult f
        JOIN DimProvider pr ON f.ProviderKey = pr.ProviderKey
        LEFT JOIN DimTest t ON f.TestKey = t.TestKey
        LEFT JOIN DimDiagnosis d ON f.DiagnosisKey = d.DiagnosisKey
        WHERE pr.DoctorId = {doctorId:UInt32}
        ${additionalFilters}
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
        ft.DoctorName as doctorName
      FROM filtered_tests ft
      JOIN latest_patient_data p ON ft.PatientKey = p.PatientKey AND p.rn = 1
      JOIN FactGeneticTestResult f_all ON ft.PatientKey = f_all.PatientKey
      GROUP BY 
        p.PatientKey, p.FullName, p.DateOfBirth, p.Gender, 
        p.Barcode, p.Address, ft.DoctorName
      ORDER BY ${orderByClause}
      LIMIT {limit:UInt32} OFFSET {offset:UInt32}
    `;

    // Count query for pagination
    const countQuery = `
      WITH latest_patient_data AS (
        SELECT PatientKey, FullName, DateOfBirth, Gender, Barcode, Address,
               ROW_NUMBER() OVER (PARTITION BY PatientKey ORDER BY EndDate DESC) as rn
        FROM DimPatient
        ${searchDto.month ? `WHERE toYear(StartDate) = {monthYear:UInt32} AND toMonth(StartDate) = {monthNum:UInt32}` : ''}
      ),
      filtered_tests AS (
        SELECT DISTINCT
          f.PatientKey
        FROM FactGeneticTestResult f
        JOIN DimProvider pr ON f.ProviderKey = pr.ProviderKey
        LEFT JOIN DimTest t ON f.TestKey = t.TestKey
        LEFT JOIN DimDiagnosis d ON f.DiagnosisKey = d.DiagnosisKey
        WHERE pr.DoctorId = {doctorId:UInt32}
        ${additionalFilters}
      )
      SELECT COUNT(DISTINCT ft.PatientKey) as total
      FROM filtered_tests ft
      JOIN latest_patient_data p ON ft.PatientKey = p.PatientKey AND p.rn = 1
    `;

    queryParams.limit = limit;
    queryParams.offset = offset;

    console.log('Executing queries...');
    console.log('Search query:', searchQuery);
    console.log('Count query:', countQuery);
    console.log('Final query parameters:', JSON.stringify(queryParams));

    try {
      const startTime = Date.now();

      console.log(
        'Executing search query with parameters:',
        JSON.stringify(queryParams, null, 2),
      );

      let searchResult: ClickHouseQueryResult;
      let countResult: ClickHouseQueryResult;

      try {
        [searchResult, countResult] = await Promise.all([
          this.clickhouseService.query(
            searchQuery,
            queryParams,
          ) as Promise<ClickHouseQueryResult>,
          this.clickhouseService.query(
            countQuery,
            queryParams,
          ) as Promise<ClickHouseQueryResult>,
        ]);
      } catch (queryError) {
        console.error('ClickHouse query execution failed:');
        console.error('Query error details:', {
          message: queryError.message,
          stack: queryError.stack,
          searchQuery: searchQuery,
          countQuery: countQuery,
          queryParams: JSON.stringify(queryParams, null, 2),
        });
        throw new Error(`Database query failed: ${queryError.message}`);
      }

      const executionTime = Date.now() - startTime;
      console.log(`Queries executed successfully in ${executionTime}ms`);

      if (!searchResult || !searchResult.data) {
        console.error('Search result is null or missing data:', searchResult);
        throw new Error('Invalid search result from database');
      }

      if (!countResult || !countResult.data || !countResult.data[0]) {
        console.error('Count result is null or missing data:', countResult);
        throw new Error('Invalid count result from database');
      }

      const patients = searchResult.data as PatientSummary[];
      const total = (countResult.data[0] as CountResult)?.total || 0;
      const totalPages = Math.ceil(total / limit);

      console.log('Query results:', {
        patientsFound: patients.length,
        totalRecords: total,
        totalPages,
        currentPage: page,
      });

      const response = {
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

      console.log('Search response prepared:', {
        dataCount: response.data.length,
        pagination: response.pagination,
      });

      console.log('=== PatientService.searchPatients END ===');

      return response;
    } catch (error) {
      console.error('=== PatientService.searchPatients ERROR ===');
      console.error('Error searching patients:', error);
      console.error('Error details:', {
        message: error.message,
        stack: error.stack,
        queryParams: JSON.stringify(queryParams),
        additionalFilters,
      });
      console.error('=== PatientService.searchPatients ERROR END ===');
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

    // Get patient basic info (latest record)
    const patientInfoQuery = `
      WITH latest_patient_data AS (
        SELECT PatientKey, PatientSourceID, FullName, DateOfBirth, Gender, Barcode, Address,
               ROW_NUMBER() OVER (PARTITION BY PatientKey ORDER BY EndDate DESC) as rn
        FROM DimPatient
        WHERE PatientKey = {patientKey:UInt64}
      )
      SELECT 
        p.PatientKey as patientKey,
        p.PatientSourceID as patientSourceId,
        p.FullName as fullName,
        p.DateOfBirth as dateOfBirth,
        p.Gender as gender,
        p.Barcode as barcode,
        p.Address as address
      FROM latest_patient_data p
      WHERE p.rn = 1
    `;

    // Get patient test statistics from ALL tests
    const patientStatsQuery = `
      SELECT 
        MAX(DateReceived) as lastTestDate,
        COUNT(TestKey) as totalTests
      FROM FactGeneticTestResult
      WHERE PatientKey = {patientKey:UInt64}
    `;

    // Get doctor name for current doctor
    const doctorNameQuery = `
      SELECT DISTINCT pr.DoctorName
      FROM FactGeneticTestResult f
      JOIN DimProvider pr ON f.ProviderKey = pr.ProviderKey
      WHERE f.PatientKey = {patientKey:UInt64} AND pr.DoctorId = {doctorId:UInt32}
      LIMIT 1
    `;

    // Get recent test results (last 5) from ALL tests, not just current doctor
    const recentTestsQuery = `
      SELECT
        f.TestKey as testKey,
        t.TestName as testName,
        t.TestCategory as testCategory,
        f.DateReceived as dateReceived,
        dd.FullDate as dateReported,
        d.DiagnosisDescription as diagnosis,
        v.VariantName as variantName,
        v.ClinicalSignificance as clinicalSignificance,
        f.Location as location,
        tr.result_etl_url as resultEtlUrl
      FROM FactGeneticTestResult f
      LEFT JOIN DimTest t ON f.TestKey = t.TestKey
      LEFT JOIN DimDate dd ON f.DateReportedKey = dd.DateKey
      LEFT JOIN DimDiagnosis d ON f.DiagnosisKey = d.DiagnosisKey
      LEFT JOIN DimVariant v ON f.VariantKey = v.VariantKey
      LEFT JOIN DimTestRun tr ON f.TestRunKey = tr.TestRunKey
      WHERE f.PatientKey = {patientKey:UInt64}
      ORDER BY f.DateReceived DESC
      LIMIT 5
    `;

    try {
      const [
        patientResult,
        patientStatsResult,
        doctorNameResult,
        recentTestsResult,
      ] = await Promise.all([
        this.clickhouseService.query(patientInfoQuery, {
          patientKey,
        }) as Promise<ClickHouseQueryResult>,
        this.clickhouseService.query(patientStatsQuery, {
          patientKey,
        }) as Promise<ClickHouseQueryResult>,
        this.clickhouseService.query(doctorNameQuery, {
          patientKey,
          doctorId,
        }) as Promise<ClickHouseQueryResult>,
        this.clickhouseService.query(recentTestsQuery, {
          patientKey,
          // Remove doctorId since recentTestsQuery now gets ALL tests
        }) as Promise<ClickHouseQueryResult>,
      ]);

      const patientData = patientResult.data[0] as PatientSummary & {
        patientSourceId: string;
      };
      if (!patientData) {
        throw new NotFoundException('Patient not found');
      }

      const patientStats = patientStatsResult.data[0] as {
        lastTestDate: string;
        totalTests: number;
      };

      const doctorName = (doctorNameResult.data[0] as { DoctorName: string })
        ?.DoctorName;

      const recentTests = recentTestsResult.data as TestResult[];

      return {
        ...patientData,
        lastTestDate: patientStats.lastTestDate,
        totalTests: patientStats.totalTests,
        doctorName: doctorName,
        recentTests,
        testHistory: [], // Will be loaded separately if needed
      };
    } catch (error) {
      console.error('Error getting patient details:', error);
      throw error;
    }
  }

  async getPatientTestHistory(
    patientKey: number,
    doctorId: number,
  ): Promise<TestHistoryItem[]> {
    // Verify ownership first - patient must have at least one visit with this doctor
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

    // Get ALL test history for this patient (not just with current doctor)
    const historyQuery = `
      SELECT
        f.TestKey as testKey,
        t.TestName as testName,
        f.DateReceived as dateReceived,
        pr.DoctorName as doctorName,
        pr.ClinicName as clinicName,
        'completed' as status,
        f.Location as location,
        tr.result_etl_url as resultEtlUrl
      FROM FactGeneticTestResult f
      LEFT JOIN DimTest t ON f.TestKey = t.TestKey
      LEFT JOIN DimProvider pr ON f.ProviderKey = pr.ProviderKey
      LEFT JOIN DimTestRun tr ON f.TestRunKey = tr.TestRunKey
      WHERE f.PatientKey = {patientKey:UInt64}
      ORDER BY f.DateReceived DESC
    `;

    try {
      const result = (await this.clickhouseService.query(historyQuery, {
        patientKey,
        // Remove doctorId parameter since we want all history
      })) as ClickHouseQueryResult;

      return result.data as TestHistoryItem[];
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
        dateCondition = 'f_all.DateReceived >= today()';
        break;
      case 'week':
        dateCondition = 'f_all.DateReceived >= date_sub(WEEK, 1, now())';
        break;
      case 'month':
        dateCondition = 'f_all.DateReceived >= date_sub(MONTH, 1, now())';
        break;
      case 'year':
        dateCondition = 'f_all.DateReceived >= date_sub(YEAR, 1, now())';
        break;
    }

    // Get patients that have at least one test with current doctor
    const patientsWithDoctorQuery = `
      SELECT DISTINCT f.PatientKey
      FROM FactGeneticTestResult f
      JOIN DimProvider pr ON f.ProviderKey = pr.ProviderKey
      WHERE pr.DoctorId = {doctorId:UInt32}
    `;

    // Total patients (that have at least one test with current doctor)
    const totalPatientsQuery = `
      WITH patients_with_doctor AS (
        ${patientsWithDoctorQuery}
      )
      SELECT COUNT(DISTINCT pwd.PatientKey) as total
      FROM patients_with_doctor pwd
    `;

    // Tests by period (ALL tests from patients that belong to current doctor)
    const testsByPeriodQuery = `
      WITH patients_with_doctor AS (
        ${patientsWithDoctorQuery}
      )
      SELECT 
        COUNT(CASE WHEN f_all.DateReceived >= today() THEN 1 END) as totalToday,
        COUNT(CASE WHEN f_all.DateReceived >= date_sub(WEEK, 1, now()) THEN 1 END) as totalThisWeek,
        COUNT(CASE WHEN f_all.DateReceived >= date_sub(MONTH, 1, now()) THEN 1 END) as totalThisMonth
      FROM patients_with_doctor pwd
      JOIN FactGeneticTestResult f_all ON pwd.PatientKey = f_all.PatientKey
    `;

    // Tests by type (ALL tests from patients that belong to current doctor, filtered by period)
    const testsByTypeQuery = `
      WITH patients_with_doctor AS (
        ${patientsWithDoctorQuery}
      )
      SELECT 
        t.TestCategory as testCategory,
        COUNT(*) as count
      FROM patients_with_doctor pwd
      JOIN FactGeneticTestResult f_all ON pwd.PatientKey = f_all.PatientKey
      LEFT JOIN DimTest t ON f_all.TestKey = t.TestKey
      WHERE ${dateCondition}
      GROUP BY t.TestCategory
      ORDER BY count DESC
      LIMIT 10
    `;

    // Top diagnoses (ALL tests from patients that belong to current doctor, filtered by period)
    const topDiagnosesQuery = `
      WITH patients_with_doctor AS (
        ${patientsWithDoctorQuery}
      )
      SELECT 
        d.DiagnosisDescription as diagnosis,
        COUNT(*) as count
      FROM patients_with_doctor pwd
      JOIN FactGeneticTestResult f_all ON pwd.PatientKey = f_all.PatientKey
      LEFT JOIN DimDiagnosis d ON f_all.DiagnosisKey = d.DiagnosisKey
      WHERE ${dateCondition}
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
