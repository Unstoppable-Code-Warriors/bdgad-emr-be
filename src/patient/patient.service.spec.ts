import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { PatientService } from './patient.service';
import { ClickHouseService } from '../clickhouse/clickhouse.service';
import { PatientSearchDto } from './dto/patient-search.dto';
import { DashboardStatsDto } from './dto/dashboard-stats.dto';

describe('PatientService', () => {
  let service: PatientService;
  let clickhouseService: jest.Mocked<ClickHouseService>;

  const mockSearchResult = {
    data: [
      {
        patientKey: 1,
        fullName: 'John Doe',
        dateOfBirth: '1990-01-01',
        gender: 'Male',
        barcode: 'BC001',
        address: '123 Main St',
        lastTestDate: '2024-01-15',
        totalTests: 5,
        doctorName: 'Dr. Smith',
      },
    ],
  };

  const mockCountResult = {
    data: [{ total: 1 }],
  };

  const mockPatientDetails = {
    data: [
      {
        patientKey: 1,
        patientSourceId: 'PS001',
        fullName: 'John Doe',
        dateOfBirth: '1990-01-01',
        gender: 'Male',
        barcode: 'BC001',
        address: '123 Main St',
        lastTestDate: '2024-01-15',
        totalTests: 5,
        doctorName: 'Dr. Smith',
      },
    ],
  };

  const mockRecentTests = {
    data: [
      {
        testKey: 1,
        testName: 'Genetic Test 1',
        testCategory: 'Genetics',
        dateReceived: '2024-01-15',
        dateReported: '2024-01-16',
        diagnosis: 'Normal',
        variantName: 'Variant A',
        clinicalSignificance: 'Benign',
      },
    ],
  };

  const mockTestHistory = {
    data: [
      {
        testKey: 1,
        testName: 'Genetic Test 1',
        dateReceived: '2024-01-15',
        doctorName: 'Dr. Smith',
        clinicName: 'Test Clinic',
        status: 'completed',
      },
    ],
  };

  const mockOwnershipResult = {
    data: [{ count: 1 }],
  };

  const mockNoOwnershipResult = {
    data: [{ count: 0 }],
  };

  beforeEach(async () => {
    const mockClickHouseService = {
      query: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PatientService,
        {
          provide: ClickHouseService,
          useValue: mockClickHouseService,
        },
      ],
    }).compile();

    service = module.get<PatientService>(PatientService);
    clickhouseService = module.get(ClickHouseService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('searchPatients', () => {
    const doctorId = 7;

    it('should search patients with default parameters', async () => {
      const searchDto: PatientSearchDto = {};

      clickhouseService.query
        .mockResolvedValueOnce(mockSearchResult)
        .mockResolvedValueOnce(mockCountResult);

      const result = await service.searchPatients(doctorId, searchDto);

      expect(result).toEqual({
        data: mockSearchResult.data,
        pagination: {
          page: 1,
          limit: 20,
          total: 1,
          totalPages: 1,
          hasNext: false,
          hasPrev: false,
        },
      });

      expect(clickhouseService.query).toHaveBeenCalledTimes(2);
    });

    it('should search patients with all filters', async () => {
      const searchDto: PatientSearchDto = {
        page: 2,
        limit: 10,
        name: 'John',
        barcode: 'BC001',
        dateFrom: '2024-01-01',
        dateTo: '2024-01-31',
        testType: 'Genetics',
        diagnosis: 'Normal',
        sortBy: 'name',
        sortOrder: 'ASC',
      };

      clickhouseService.query
        .mockResolvedValueOnce(mockSearchResult)
        .mockResolvedValueOnce(mockCountResult);

      const result = await service.searchPatients(doctorId, searchDto);

      expect(result.pagination.page).toBe(2);
      expect(result.pagination.limit).toBe(10);
      expect(clickhouseService.query).toHaveBeenCalledTimes(2);

      // Verify that the query includes all filter conditions
      const firstCall = clickhouseService.query.mock.calls[0];
      const query = firstCall[0];
      const params = firstCall[1];

      expect(query).toContain('p.FullName ILIKE');
      expect(query).toContain('p.Barcode =');
      expect(query).toContain('f.DateReceived >=');
      expect(query).toContain('f.DateReceived <=');
      expect(query).toContain('t.TestCategory =');
      expect(query).toContain('d.DiagnosisDescription ILIKE');
      expect(query).toContain('ORDER BY p.FullName ASC');

      expect(params?.name).toBe('%John%');
      expect(params?.barcode).toBe('BC001');
      expect(params?.dateFrom).toBe('2024-01-01');
      expect(params?.dateTo).toBe('2024-01-31');
      expect(params?.testType).toBe('Genetics');
      expect(params?.diagnosis).toBe('%Normal%');
      expect(params?.limit).toBe(10);
      expect(params?.offset).toBe(10);
    });

    it('should handle different sort options', async () => {
      const sortOptions = [
        { sortBy: 'lastTestDate', sortOrder: 'DESC' },
        { sortBy: 'name', sortOrder: 'ASC' },
        { sortBy: 'dateOfBirth', sortOrder: 'DESC' },
      ] as const;

      for (const { sortBy, sortOrder } of sortOptions) {
        clickhouseService.query.mockClear();
        clickhouseService.query
          .mockResolvedValueOnce(mockSearchResult)
          .mockResolvedValueOnce(mockCountResult);

        const searchDto: PatientSearchDto = { sortBy, sortOrder };
        await service.searchPatients(doctorId, searchDto);

        const query = clickhouseService.query.mock.calls[0][0];
        if (sortBy === 'name') {
          expect(query).toContain(`p.FullName ${sortOrder}`);
        } else if (sortBy === 'dateOfBirth') {
          expect(query).toContain(`p.DateOfBirth ${sortOrder}`);
        } else {
          expect(query).toContain(`lastTestDate ${sortOrder}`);
        }
      }
    });

    it('should calculate pagination correctly', async () => {
      const largeMockCountResult = { data: [{ total: 100 }] };
      const searchDto: PatientSearchDto = { page: 3, limit: 20 };

      clickhouseService.query
        .mockResolvedValueOnce(mockSearchResult)
        .mockResolvedValueOnce(largeMockCountResult);

      const result = await service.searchPatients(doctorId, searchDto);

      expect(result.pagination).toEqual({
        page: 3,
        limit: 20,
        total: 100,
        totalPages: 5,
        hasNext: true,
        hasPrev: true,
      });
    });

    it('should handle database errors', async () => {
      const searchDto: PatientSearchDto = {};
      const error = new Error('Database connection failed');

      clickhouseService.query.mockRejectedValue(error);

      await expect(service.searchPatients(doctorId, searchDto)).rejects.toThrow(
        'Database connection failed',
      );
    });
  });

  describe('getPatientDetails', () => {
    const patientKey = 1;
    const doctorId = 7;

    it('should return patient details when authorized', async () => {
      clickhouseService.query
        .mockResolvedValueOnce(mockOwnershipResult)
        .mockResolvedValueOnce(mockPatientDetails)
        .mockResolvedValueOnce(mockRecentTests);

      const result = await service.getPatientDetails(patientKey, doctorId);

      expect(result).toEqual({
        ...mockPatientDetails.data[0],
        recentTests: mockRecentTests.data,
        testHistory: [],
      });

      expect(clickhouseService.query).toHaveBeenCalledTimes(3);
    });

    it('should throw NotFoundException when patient not found or unauthorized', async () => {
      clickhouseService.query.mockResolvedValueOnce(mockNoOwnershipResult);

      await expect(
        service.getPatientDetails(patientKey, doctorId),
      ).rejects.toThrow(NotFoundException);
      await expect(
        service.getPatientDetails(patientKey, doctorId),
      ).rejects.toThrow('Patient not found or access denied');
    });

    it('should throw NotFoundException when patient data is empty', async () => {
      clickhouseService.query
        .mockResolvedValueOnce(mockOwnershipResult)
        .mockResolvedValueOnce({ data: [] })
        .mockResolvedValueOnce(mockRecentTests);

      await expect(
        service.getPatientDetails(patientKey, doctorId),
      ).rejects.toThrow(NotFoundException);
      await expect(
        service.getPatientDetails(patientKey, doctorId),
      ).rejects.toThrow('Patient not found');
    });

    it('should handle database errors', async () => {
      const error = new Error('Database error');
      clickhouseService.query.mockRejectedValue(error);

      await expect(
        service.getPatientDetails(patientKey, doctorId),
      ).rejects.toThrow('Database error');
    });
  });

  describe('getPatientTestHistory', () => {
    const patientKey = 1;
    const doctorId = 7;

    it('should return test history when authorized', async () => {
      clickhouseService.query
        .mockResolvedValueOnce(mockOwnershipResult)
        .mockResolvedValueOnce(mockTestHistory);

      const result = await service.getPatientTestHistory(patientKey, doctorId);

      expect(result).toEqual(mockTestHistory.data);
      expect(clickhouseService.query).toHaveBeenCalledTimes(2);
    });

    it('should throw NotFoundException when unauthorized', async () => {
      clickhouseService.query.mockResolvedValueOnce(mockNoOwnershipResult);

      await expect(
        service.getPatientTestHistory(patientKey, doctorId),
      ).rejects.toThrow(NotFoundException);
      await expect(
        service.getPatientTestHistory(patientKey, doctorId),
      ).rejects.toThrow('Patient not found or access denied');
    });

    it('should return empty array when no history exists', async () => {
      clickhouseService.query
        .mockResolvedValueOnce(mockOwnershipResult)
        .mockResolvedValueOnce({ data: [] });

      const result = await service.getPatientTestHistory(patientKey, doctorId);

      expect(result).toEqual([]);
    });

    it('should handle database errors', async () => {
      const error = new Error('Query failed');
      clickhouseService.query.mockRejectedValue(error);

      await expect(
        service.getPatientTestHistory(patientKey, doctorId),
      ).rejects.toThrow('Query failed');
    });
  });

  describe('getDashboardStats', () => {
    const doctorId = 7;

    const mockStatsResults = [
      { data: [{ total: 100 }] }, // total patients
      { data: [{ totalToday: 5, totalThisWeek: 25, totalThisMonth: 100 }] }, // period stats
      { data: [{ testCategory: 'Genetics', count: 80 }] }, // tests by type
      { data: [{ diagnosis: 'Normal', count: 50 }] }, // top diagnoses
    ];

    it('should return dashboard stats for week period', async () => {
      const statsDto: DashboardStatsDto = { period: 'week' };

      clickhouseService.query
        .mockResolvedValueOnce(mockStatsResults[0])
        .mockResolvedValueOnce(mockStatsResults[1])
        .mockResolvedValueOnce(mockStatsResults[2])
        .mockResolvedValueOnce(mockStatsResults[3]);

      const result = await service.getDashboardStats(doctorId, statsDto);

      expect(result).toEqual({
        totalPatients: 100,
        totalTestsToday: 5,
        totalTestsThisWeek: 25,
        totalTestsThisMonth: 100,
        testsByType: [{ testCategory: 'Genetics', count: 80 }],
        patientsByPeriod: [],
        topDiagnoses: [{ diagnosis: 'Normal', count: 50 }],
      });

      expect(clickhouseService.query).toHaveBeenCalledTimes(4);
    });

    it('should handle different periods', async () => {
      const periods = ['day', 'week', 'month', 'year'] as const;

      for (const period of periods) {
        clickhouseService.query.mockClear();
        mockStatsResults.forEach((result) => {
          clickhouseService.query.mockResolvedValueOnce(result);
        });

        const statsDto: DashboardStatsDto = { period };
        await service.getDashboardStats(doctorId, statsDto);

        const testsByTypeQuery = clickhouseService.query.mock.calls[2][0];
        const topDiagnosesQuery = clickhouseService.query.mock.calls[3][0];

        switch (period) {
          case 'day':
            expect(testsByTypeQuery).toContain('f.DateReceived >= today()');
            expect(topDiagnosesQuery).toContain('f.DateReceived >= today()');
            break;
          case 'week':
            expect(testsByTypeQuery).toContain(
              'f.DateReceived >= date_sub(WEEK, 1, now())',
            );
            expect(topDiagnosesQuery).toContain(
              'f.DateReceived >= date_sub(WEEK, 1, now())',
            );
            break;
          case 'month':
            expect(testsByTypeQuery).toContain(
              'f.DateReceived >= date_sub(MONTH, 1, now())',
            );
            expect(topDiagnosesQuery).toContain(
              'f.DateReceived >= date_sub(MONTH, 1, now())',
            );
            break;
          case 'year':
            expect(testsByTypeQuery).toContain(
              'f.DateReceived >= date_sub(YEAR, 1, now())',
            );
            expect(topDiagnosesQuery).toContain(
              'f.DateReceived >= date_sub(YEAR, 1, now())',
            );
            break;
        }
      }
    });

    it('should handle empty results gracefully', async () => {
      const emptyResults = [
        { data: [] },
        { data: [] },
        { data: [] },
        { data: [] },
      ];

      emptyResults.forEach((result) => {
        clickhouseService.query.mockResolvedValueOnce(result);
      });

      const statsDto: DashboardStatsDto = { period: 'week' };
      const result = await service.getDashboardStats(doctorId, statsDto);

      expect(result).toEqual({
        totalPatients: 0,
        totalTestsToday: 0,
        totalTestsThisWeek: 0,
        totalTestsThisMonth: 0,
        testsByType: [],
        patientsByPeriod: [],
        topDiagnoses: [],
      });
    });

    it('should handle database errors', async () => {
      const error = new Error('Stats query failed');
      clickhouseService.query.mockRejectedValue(error);

      const statsDto: DashboardStatsDto = { period: 'week' };

      await expect(
        service.getDashboardStats(doctorId, statsDto),
      ).rejects.toThrow('Stats query failed');
    });
  });
});
