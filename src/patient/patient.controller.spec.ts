import { Test, TestingModule } from '@nestjs/testing';
import { PatientController } from './patient.controller';
import { PatientService } from './patient.service';
import { AuthGuard } from '../auth/guards/auth.guard';
import { UserInfo } from '../auth/interfaces/user-info.interface';
import { PatientSearchDto } from './dto/patient-search.dto';
import { DashboardStatsDto } from './dto/dashboard-stats.dto';
import { NotFoundException } from '@nestjs/common';

describe('PatientController', () => {
  let controller: PatientController;
  let patientService: jest.Mocked<PatientService>;

  const mockUser: UserInfo = {
    id: 7,
    email: 'test@example.com',
    name: 'Test User',
    roles: [
      {
        id: 2,
        name: 'Lab Testing Technician',
        code: '2',
      },
    ],
  };

  const mockSearchResponse = {
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
    pagination: {
      page: 1,
      limit: 20,
      total: 1,
      totalPages: 1,
      hasNext: false,
      hasPrev: false,
    },
  };

  const mockPatientDetails = {
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
    extendedInfo: null,
    recentTests: [
      {
        testKey: 1,
        testName: 'Genetic Test 1',
        testCategory: 'Genetics',
        dateReceived: '2024-01-15',
        dateReported: '2024-01-16',
        diagnosis: 'Normal',
        variantName: 'Variant A',
        clinicalSignificance: 'Benign',
        location: 'bdgad',
        resultEtlUrl:
          'https://d46919b3b31b61ac349836b18c9ac671.r2.cloudflarestorage.com/results/patient-1/test-1.pdf',
        ehrUrl: null,
      },
    ],
    testHistory: [],
  };

  const mockTestHistory = [
    {
      testKey: 1,
      testName: 'Genetic Test 1',
      dateReceived: '2024-01-15',
      doctorName: 'Dr. Smith',
      clinicName: 'Test Clinic',
      status: 'completed' as const,
      location: 'bdgad',
      resultEtlUrl:
        'https://d46919b3b31b61ac349836b18c9ac671.r2.cloudflarestorage.com/results/patient-1/test-1.pdf',
      ehrUrl: null,
    },
  ];

  const mockDashboardStats = {
    totalPatients: 100,
    totalTestsToday: 5,
    totalTestsThisWeek: 25,
    totalTestsThisMonth: 100,
    testsByType: [
      { testCategory: 'Genetics', count: 80 },
      { testCategory: 'Blood', count: 20 },
    ],
    patientsByPeriod: [],
    topDiagnoses: [
      { diagnosis: 'Normal', count: 50 },
      { diagnosis: 'Abnormal', count: 30 },
    ],
  };

  beforeEach(async () => {
    const mockPatientService = {
      searchPatients: jest.fn(),
      getDashboardStats: jest.fn(),
      getPatientDetails: jest.fn(),
      getPatientTestHistory: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [PatientController],
      providers: [
        {
          provide: PatientService,
          useValue: mockPatientService,
        },
      ],
    })
      .overrideGuard(AuthGuard)
      .useValue({ canActivate: jest.fn(() => true) })
      .compile();

    controller = module.get<PatientController>(PatientController);
    patientService = module.get(PatientService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('searchPatients', () => {
    it('should return paginated search results', async () => {
      const searchDto: PatientSearchDto = {
        page: 1,
        limit: 20,
        name: 'John',
        sortBy: 'lastTestDate',
        sortOrder: 'DESC',
      };

      patientService.searchPatients.mockResolvedValue(mockSearchResponse);

      const result = await controller.searchPatients(mockUser, searchDto);

      expect(result).toEqual(mockSearchResponse);
      expect(patientService.searchPatients).toHaveBeenCalledWith(
        mockUser.id,
        searchDto,
      );
    });

    it('should handle search with filters', async () => {
      const searchDto: PatientSearchDto = {
        page: 1,
        limit: 10,
        name: 'Jane',
        barcode: 'BC002',
        dateFrom: '2024-01-01',
        dateTo: '2024-01-31',
        testType: 'Genetics',
        diagnosis: 'Normal',
        sortBy: 'name',
        sortOrder: 'ASC',
      };

      patientService.searchPatients.mockResolvedValue(mockSearchResponse);

      const result = await controller.searchPatients(mockUser, searchDto);

      expect(result).toEqual(mockSearchResponse);
      expect(patientService.searchPatients).toHaveBeenCalledWith(
        mockUser.id,
        searchDto,
      );
    });

    it('should handle empty search results', async () => {
      const searchDto: PatientSearchDto = {
        page: 1,
        limit: 20,
      };

      const emptyResponse = {
        data: [],
        pagination: {
          page: 1,
          limit: 20,
          total: 0,
          totalPages: 0,
          hasNext: false,
          hasPrev: false,
        },
      };

      patientService.searchPatients.mockResolvedValue(emptyResponse);

      const result = await controller.searchPatients(mockUser, searchDto);

      expect(result).toEqual(emptyResponse);
    });

    it('should propagate service errors', async () => {
      const searchDto: PatientSearchDto = { page: 1, limit: 20 };
      const error = new Error('Database connection failed');

      patientService.searchPatients.mockRejectedValue(error);

      await expect(
        controller.searchPatients(mockUser, searchDto),
      ).rejects.toThrow('Database connection failed');
    });
  });

  describe('getDashboardStats', () => {
    it('should return dashboard statistics', async () => {
      const statsDto: DashboardStatsDto = { period: 'week' };

      patientService.getDashboardStats.mockResolvedValue(mockDashboardStats);

      const result = await controller.getDashboardStats(mockUser, statsDto);

      expect(result).toEqual(mockDashboardStats);
      expect(patientService.getDashboardStats).toHaveBeenCalledWith(
        mockUser.id,
        statsDto,
      );
    });

    it('should handle different periods', async () => {
      const periods = ['day', 'week', 'month', 'year'] as const;

      for (const period of periods) {
        const statsDto: DashboardStatsDto = { period };
        patientService.getDashboardStats.mockResolvedValue(mockDashboardStats);

        const result = await controller.getDashboardStats(mockUser, statsDto);

        expect(result).toEqual(mockDashboardStats);
        expect(patientService.getDashboardStats).toHaveBeenCalledWith(
          mockUser.id,
          statsDto,
        );
      }
    });

    it('should handle service errors', async () => {
      const statsDto: DashboardStatsDto = { period: 'week' };
      const error = new Error('Query failed');

      patientService.getDashboardStats.mockRejectedValue(error);

      await expect(
        controller.getDashboardStats(mockUser, statsDto),
      ).rejects.toThrow('Query failed');
    });
  });

  describe('getPatientDetails', () => {
    it('should return patient details', async () => {
      const patientKey = 1;

      patientService.getPatientDetails.mockResolvedValue(mockPatientDetails);

      const result = await controller.getPatientDetails(mockUser, patientKey);

      expect(result).toEqual(mockPatientDetails);
      expect(patientService.getPatientDetails).toHaveBeenCalledWith(
        patientKey,
        mockUser.id,
      );
    });

    it('should handle invalid patient ID', async () => {
      const patientKey = 999;
      const error = new NotFoundException('Patient not found or access denied');

      patientService.getPatientDetails.mockRejectedValue(error);

      await expect(
        controller.getPatientDetails(mockUser, patientKey),
      ).rejects.toThrow('Patient not found or access denied');
    });

    it('should handle different user accessing patient', async () => {
      const patientKey = 1;
      const differentUser = { ...mockUser, id: 999 };
      const error = new NotFoundException('Patient not found or access denied');

      patientService.getPatientDetails.mockRejectedValue(error);

      await expect(
        controller.getPatientDetails(differentUser, patientKey),
      ).rejects.toThrow('Patient not found or access denied');
    });
  });

  describe('getPatientTestHistory', () => {
    it('should return patient test history', async () => {
      const patientKey = 1;

      patientService.getPatientTestHistory.mockResolvedValue(mockTestHistory);

      const result = await controller.getPatientTestHistory(
        mockUser,
        patientKey,
      );

      expect(result).toEqual(mockTestHistory);
      expect(patientService.getPatientTestHistory).toHaveBeenCalledWith(
        patientKey,
        mockUser.id,
      );
    });

    it('should handle patient with no test history', async () => {
      const patientKey = 1;

      patientService.getPatientTestHistory.mockResolvedValue([]);

      const result = await controller.getPatientTestHistory(
        mockUser,
        patientKey,
      );

      expect(result).toEqual([]);
    });

    it('should handle unauthorized access', async () => {
      const patientKey = 1;
      const error = new NotFoundException('Patient not found or access denied');

      patientService.getPatientTestHistory.mockRejectedValue(error);

      await expect(
        controller.getPatientTestHistory(mockUser, patientKey),
      ).rejects.toThrow('Patient not found or access denied');
    });

    it('should handle service errors', async () => {
      const patientKey = 1;
      const error = new Error('Database error');

      patientService.getPatientTestHistory.mockRejectedValue(error);

      await expect(
        controller.getPatientTestHistory(mockUser, patientKey),
      ).rejects.toThrow('Database error');
    });
  });

  describe('Guard Integration', () => {
    it('should be protected by AuthGuard', () => {
      const guards = Reflect.getMetadata('__guards__', PatientController);
      expect(guards).toContain(AuthGuard);
    });
  });
});
