import { Injectable, Logger } from '@nestjs/common';
import { createSystemMessages } from './constants/prompt';
import { ChatReqDto } from './dto/chat-req.dto';
import { convertToModelMessages, stepCountIs, streamText, tool } from 'ai';
import { openai } from '@ai-sdk/openai';
import { UserInfo } from 'src/auth';
import z from 'zod';
import { DaytonaService } from 'src/daytona/daytona.service';
import { DoctorChatReqDto } from './dto/doctor-chat-req.dto';
import { createSystemDoctorMessages } from './constants/doctor-prompt';
import { ClickHouseService } from 'src/clickhouse/clickhouse.service';

@Injectable()
export class AiChatService {
  private readonly logger = new Logger(AiChatService.name);

  constructor(
    private readonly daytonaService: DaytonaService,
    private readonly clickHouseService: ClickHouseService,
  ) {}

  public async handleDoctorChat(request: DoctorChatReqDto, user: UserInfo) {
    const { messages: uiMessages } = request;
    const messages = convertToModelMessages(uiMessages);

    const result = streamText({
      model: openai.responses('gpt-4.1-mini'),
      messages: [...createSystemDoctorMessages(user.id), ...messages],
      temperature: 0.3,
      maxOutputTokens: 2000,
      stopWhen: stepCountIs(10),
      tools: {
        // Tool để khám phá schema của ClickHouse
        exploreClickHouseSchema: tool({
          description: `Khám phá cấu trúc schema của ClickHouse để hiểu các bảng và cột có sẵn.
          
          Sử dụng tool này khi:
          - Bác sĩ yêu cầu xem thông tin chi tiết bệnh nhân (lịch sử khám, hồ sơ y tế)
          - Cần hiểu cấu trúc dữ liệu trước khi truy vấn thông tin phức tạp
          - Là BƯỚC 1 trong workflow xem chi tiết bệnh nhân
          
          Có thể gọi nhiều lần để khám phá đầy đủ:
          - Danh sách các bảng trong database
          - Cấu trúc cột của các bảng liên quan đến bệnh nhân
          - Tìm hiểu mối quan hệ giữa bác sĩ và bệnh nhân (DoctorId field)
          - Hiểu các bảng chứa lịch sử khám, xét nghiệm, thuốc, etc.
          
          CẤU TRÚC DỮ LIỆU QUAN TRỌNG:
          - DimTestRun: chứa thông tin chi tiết từng lần khám của bệnh nhân
          - DimTestRun.EHR_url: cột chứa chi tiết hồ sơ y tế theo từng lần khám
          - FactGeneticTestResult: dữ liệu các lần khám
          - DimPatient: thông tin cơ bản bệnh nhân
          - DimProvider: thông tin bác sĩ và quyền truy cập`,
          inputSchema: z.object({
            action: z
              .enum(['list_tables', 'describe_table'])
              .describe(
                'Hành động khám phá: liệt kê databases, tables, hoặc mô tả cấu trúc table',
              ),
            tableName: z
              .string()
              .optional()
              .describe(
                'Tên bảng cần mô tả (bắt buộc khi action là describe_table)',
              ),
          }),
          execute: async ({ action, tableName }) => {
            return await this.executeClickHouseExploration(action, tableName);
          },
        }),

        // Tool để tìm kiếm bệnh nhân và trả về danh sách
        searchPatients: tool({
          description: `Tìm kiếm cơ bản bệnh nhân trong hệ thống EMR với nhiều tiêu chí linh hoạt.
          
          Sử dụng tool này khi:
          - Tìm kiếm, đếm số lượng bệnh nhân cơ bản
          - Tìm kiếm bệnh nhân theo tên, CMND, giới tính
          - Tìm theo độ tuổi (khoảng năm sinh)
          - Tìm theo số lần khám (khoảng từ X đến Y lần)
          - Tìm bệnh nhân có khám trong khoảng thời gian cụ thể
          - KHÔNG dùng khi cần xem chi tiết thông tin bệnh nhân
          
          Các tính năng tìm kiếm:
          - Hỗ trợ khoảng ngày sinh (fromDob, toDob)
          - Hỗ trợ khoảng số lần khám (minVisitCount, maxVisitCount)  
          - Hỗ trợ khoảng thời gian khám (fromVisitDate, toVisitDate)
          - Có thể kết hợp nhiều điều kiện
          
          QUAN TRỌNG: 
          - Sau khi gọi tool này, CHỈ trả lời số lượng bệnh nhân tìm được
          - KHÔNG đưa ra thông tin chi tiết của bệnh nhân
          - KHÔNG đề cập đến tên bảng, tên cột hay thuật ngữ kỹ thuật
          - Trả lời đơn giản, dễ hiểu cho bác sĩ`,
          inputSchema: z.object({
            searchCriteria: z.object({
              name: z
                .string()
                .optional()
                .describe('Tên bệnh nhân cần tìm (LIKE search)'),
              citizenId: z
                .string()
                .optional()
                .describe('CMND/CCCD của bệnh nhân'),
              gender: z.string().optional().describe('Giới tính (Nam/Nữ)'),
              dateOfBirth: z
                .string()
                .optional()
                .describe('Ngày sinh cụ thể (YYYY-MM-DD)'),
              fromDob: z
                .string()
                .optional()
                .describe('Ngày sinh từ (YYYY-MM-DD)'),
              toDob: z
                .string()
                .optional()
                .describe('Ngày sinh đến (YYYY-MM-DD)'),
              minVisitCount: z
                .number()
                .optional()
                .describe('Số lần khám tối thiểu'),
              maxVisitCount: z
                .number()
                .optional()
                .describe('Số lần khám tối đa'),
              fromVisitDate: z
                .string()
                .optional()
                .describe('Tìm bệnh nhân có khám từ ngày (YYYY-MM-DD)'),
              toVisitDate: z
                .string()
                .optional()
                .describe('Tìm bệnh nhân có khám đến ngày (YYYY-MM-DD)'),
              limit: z
                .number()
                .optional()
                .default(20)
                .describe('Giới hạn số lượng kết quả (mặc định 20)'),
            }),
            purpose: z.string().describe('Mục đích tìm kiếm (để logging)'),
          }),
          execute: async ({ searchCriteria, purpose }) => {
            return await this.executePatientSearch(
              searchCriteria,
              purpose,
              user.id,
            );
          },
        }),

        // Tool để thực hiện các truy vấn thống kê và phân tích chung
        commonQuery: tool({
          description: `Thực hiện các truy vấn thống kê, phân tích dữ liệu EMR và xem chi tiết bệnh nhân bằng ClickHouse SQL.
          
          Sử dụng tool này khi:
          - XEM CHI TIẾT BỆNH NHÂN: lịch sử khám, hồ sơ y tế, kết quả xét nghiệm
          - Đếm tổng số bệnh nhân, xét nghiệm, etc.
          - Thống kê theo thời gian, giới tính, độ tuổi
          - Phân tích xu hướng, báo cáo
          - Các truy vấn SELECT phức tạp mà searchPatients không đủ khả năng
          
          WORKFLOW CHI TIẾT BỆNH NHÂN:
          - Là BƯỚC 2 sau khi đã dùng exploreClickHouseSchema
          - Dựa vào schema đã khám phá để viết query phù hợp
          - Có thể truy vấn nhiều bảng: FactGeneticTestResult, DimPatient, DimProvider, DimTestRun, etc.
          
          THÔNG TIN CHI TIẾT BỆNH NHÂN:
          - DimTestRun.EHR_url: chứa thông tin chi tiết hồ sơ y tế của từng lần khám
          - Để xem chi tiết lịch sử khám của bệnh nhân, cần JOIN với DimTestRun và lấy EHR_url
          - DimTestRun có thể chứa nhiều records cho mỗi bệnh nhân (theo từng lần khám)
          
          QUAN TRỌNG - Quy tắc bảo mật và cú pháp:
          - CHỈ được phép thực hiện câu lệnh SELECT (ClickHouse SQL)
          - BẮT BUỘC: Luôn luôn PHẢI có điều kiện WHERE để giới hạn dữ liệu chỉ cho bác sĩ hiện tại
          - Cú pháp bảo mật: WHERE EXISTS (SELECT 1 FROM default.DimProvider dp WHERE dp.ProviderKey = [table].ProviderKey AND dp.DoctorId = ${user.id})
          - HOẶC: WHERE [table].ProviderKey IN (SELECT ProviderKey FROM default.DimProvider WHERE DoctorId = ${user.id})
          - Sử dụng cú pháp ClickHouse: backticks cho table/column names, toDate(), formatDateTime(), etc.
          - Database prefix: default.TableName
          - Không được thiếu điều kiện bảo mật trong bất kỳ truy vấn nào`,
          inputSchema: z.object({
            query: z
              .string()
              .describe(
                'Câu lệnh ClickHouse SQL SELECT với cú pháp chính xác. BẮT BUỘC phải có điều kiện WHERE giới hạn quyền truy cập cho bác sĩ hiện tại qua DimProvider table. Để xem chi tiết lịch sử khám bệnh nhân, JOIN với DimTestRun và lấy EHR_url.',
              ),
            purpose: z
              .string()
              .describe('Mục đích truy vấn (để logging và kiểm tra)'),
          }),
          execute: async ({ query, purpose }) => {
            return await this.executeCommonQuery(query, purpose, user.id);
          },
        }),
      },
    });

    return result;
  }

  public async handleChat(request: ChatReqDto) {
    const { messages: uiMessages, excelFilePath } = request;
    const messages = convertToModelMessages(uiMessages);

    const result = streamText({
      model: openai.responses('gpt-4.1-mini'),
      messages: [...createSystemMessages(excelFilePath), ...messages],
      temperature: 0.3, // Lower temperature for more consistent medical analysis
      maxOutputTokens: 1500, // Reduced to prevent excessive output
      stopWhen: stepCountIs(6), // Reduced from 10 to 6: 4 analysis steps + 1 web search + 1 final report
      tools: {
        // Web search tool for medical research - WITH USAGE TRACKING
        web_search_preview: openai.tools.webSearchPreview({
          toModelOutput: (output) => {
            this.logger.log(
              'Web search performed for genomics analysis - SINGLE USE ONLY',
            );
            return output;
          },
        }),

        // STEP 1: Explore file structure
        exploreFileStructure: tool({
          description: `BƯỚC 1: Khám phá cấu trúc file Excel openCRAVAT.
          
          Phân tích:
          - Tất cả sheets trong file Excel
          - Columns và sample data trong mỗi sheet
          - Identify key columns (gene, clinvar, cosmic, etc.)
          - Tạo structure report cho bước tiếp theo
          
          Luôn chạy bước này TRƯỚC TIÊN để hiểu cấu trúc file.`,
          inputSchema: z.object({
            retryCount: z
              .number()
              .optional()
              .default(0)
              .describe('Số lần retry nếu có lỗi'),
          }),
          execute: async ({ retryCount = 0 }) => {
            this.logger.log(`Exploring file structure, retry: ${retryCount}`);
            return await this.executeExploreStep(excelFilePath, retryCount);
          },
        }),

        // STEP 2: Focus on Gene sheet analysis - count variants by gene
        createGeneAnalysisStrategy: tool({
          description: `BƯỚC 2: Phân tích bảng Gene sheet để thống kê top các biến thể.
          
          Tập trung vào:
          - Bỏ qua row đầu tiên và row thứ 2 (headers)
          - Cột A: tên biến thể (gene/variant)
          - Cột C: số lượng (count)
          - Thống kê top các biến thể dựa trên số lượng
          - Sắp xếp giảm dần theo số lượng để tìm biến thể phổ biến nhất
          
          Output: danh sách top biến thể với số lượng tương ứng`,
          inputSchema: z.object({
            pythonCode: z
              .string()
              .describe(
                'Python code để phân tích Gene sheet, bỏ qua 2 row đầu, đếm biến thể theo cột A/C',
              ),
            retryCount: z
              .number()
              .optional()
              .default(0)
              .describe('Số lần retry nếu có lỗi'),
          }),
          execute: async ({ pythonCode, retryCount = 0 }) => {
            this.logger.log(
              `Creating gene analysis strategy with LLM code, retry: ${retryCount}`,
            );
            return await this.executeGeneStrategyStep(pythonCode, retryCount);
          },
        }),

        // STEP 3: Prepare search queries for top variants
        prepareVariantSearch: tool({
          description: `BƯỚC 3: Chuẩn bị search queries cho các biến thể hàng đầu.
          
          Dựa vào kết quả từ bước 2:
          - Tạo search queries cho top biến thể
          - Focus vào clinical significance, disease associations
          - Generate queries phù hợp cho web search
          
          Input: Top variants list từ bước 2`,
          inputSchema: z.object({
            pythonCode: z
              .string()
              .describe(
                'Python code để chuẩn bị search queries cho top variants',
              ),
            retryCount: z
              .number()
              .optional()
              .default(0)
              .describe('Số lần retry nếu có lỗi'),
          }),
          execute: async ({ pythonCode, retryCount = 0 }) => {
            this.logger.log(
              `Preparing variant search with LLM code, retry: ${retryCount}`,
            );
            return await this.executeVariantSearchStep(pythonCode, retryCount);
          },
        }),

        // Optional: Clinical database lookup tool
        lookupClinicalDatabase: tool({
          description: `Tra cứu thông tin từ các database y khoa về variants/genes cụ thể.
          Sử dụng sau khi đã có kết quả phân tích genomics data.`,
          inputSchema: z.object({
            queryType: z.enum(['variant', 'gene', 'phenotype']),
            searchTerm: z
              .string()
              .describe('Variant ID, gene name, hoặc phenotype cần tra cứu'),
            databases: z
              .array(z.string())
              .optional()
              .describe('Databases cần tra cứu (ClinVar, COSMIC, dbSNP)'),
          }),
          execute: async ({ queryType, searchTerm, databases }) => {
            // This could integrate with APIs like:
            // - ClinVar API
            // - COSMIC API
            // - dbSNP API
            // For now, return structured guidance for web search

            return {
              queryType,
              searchTerm,
              suggestedWebSearches: this.generateClinicalSearchQueries(
                queryType,
                searchTerm,
              ),
              databases: databases || ['ClinVar', 'COSMIC', 'dbSNP', 'gnomAD'],
            };
          },
        }),
      },
    });

    return result;
  }

  private async executeExploreStep(
    excelFilePath?: string,
    retryCount: number = 0,
  ) {
    try {
      const exploreCode = `
# BƯỚC 1: KHÁM PHÁ CẤU TRÚC FILE EXCEL
import pandas as pd
import numpy as np

excel_file_path = "${excelFilePath || ''}"
print("🔍 BƯỚC 1: KHÁM PHÁ CẤU TRÚC FILE OPENCRAVAT")
print(f"📂 File: {excel_file_path}")

try:
    # Load all sheets
    excel_data = pd.read_excel(excel_file_path, sheet_name=None)
    print(f"✅ File loaded successfully!")
    print(f"📋 Sheets found: {list(excel_data.keys())}")
    
    structure_info = {}
    
    for sheet_name, sheet_data in excel_data.items():
        print(f"\\n📊 Sheet '{sheet_name}':")
        print(f"  - Rows: {len(sheet_data)}")
        print(f"  - Columns: {len(sheet_data.columns)}")
        
        if len(sheet_data) > 0:
            # Show first few column names
            print(f"  - Column samples: {list(sheet_data.columns[:5])}")
            
            # Identify key columns
            key_cols = []
            for col in sheet_data.columns:
                col_lower = col.lower()
                if any(keyword in col_lower for keyword in [
                    'gene', 'chrom', 'position', 'clinvar', 'cosmic',
                    'significance', 'ontology', 'consequence', 'zygosity',
                    'frequency', 'pathogenic', 'disease', 'af'
                ]):
                    key_cols.append(col)
            
            if key_cols:
                print(f"  - Key columns: {key_cols}")
            
            structure_info[sheet_name] = {
                'rows': len(sheet_data),
                'columns': list(sheet_data.columns),
                'key_columns': key_cols
            }
    
    print(f"\\n✅ EXPLORATION COMPLETED")
    print(f"Structure info saved for strategy planning.")
    
    # Save structure info for next steps
    import json
    globals()['file_structure'] = structure_info
    
except Exception as e:
    print(f"❌ Error exploring file: {str(e)}")
    raise
`;

      const result = await this.daytonaService.executePythonCode(exploreCode);

      if (result.exitCode === 0) {
        return {
          success: true,
          stepName: 'explore',
          result: result.result,
          nextStep: 'gene_analysis',
          message:
            '✅ Đã khám phá xong cấu trúc file. Tiếp theo: phân tích Gene sheet.',
        };
      } else {
        throw new Error(`Exploration failed: ${result.result}`);
      }
    } catch (error) {
      if (retryCount < 3) {
        return {
          success: false,
          stepName: 'explore',
          error: error.message,
          nextStep: 'explore',
          retryCount: retryCount + 1,
          message: `❌ Lỗi khám phá file (lần ${retryCount + 1}). Đang thử lại...`,
        };
      }
      return {
        success: false,
        stepName: 'explore',
        error: error.message,
        nextStep: null,
        message: '❌ Không thể khám phá cấu trúc file sau 3 lần thử.',
      };
    }
  }

  private async executeGeneStrategyStep(
    pythonCode?: string,
    retryCount: number = 0,
  ) {
    try {
      // If no pythonCode provided, return error (LLM should generate it)
      if (!pythonCode) {
        throw new Error(
          'No Python code provided for gene analysis strategy step. LLM should generate the analysis strategy code.',
        );
      }

      this.logger.log('Executing LLM-generated gene analysis strategy code');
      const result = await this.daytonaService.executePythonCode(pythonCode);

      if (result.exitCode === 0) {
        return {
          success: true,
          stepName: 'gene_analysis',
          result: result.result,
          nextStep: 'variant_search',
          message:
            '✅ Đã phân tích Gene sheet và thống kê top biến thể. Tiếp theo: chuẩn bị search queries.',
        };
      } else {
        throw new Error(
          `Gene analysis strategy planning failed: ${result.result}`,
        );
      }
    } catch (error) {
      if (retryCount < 3) {
        return {
          success: false,
          stepName: 'gene_analysis',
          error: error.message,
          nextStep: 'gene_analysis',
          retryCount: retryCount + 1,
          message: `❌ Lỗi phân tích Gene sheet (lần ${retryCount + 1}). LLM cần generate code mới để phân tích Gene sheet...`,
        };
      }
      return {
        success: false,
        stepName: 'gene_analysis',
        error: error.message,
        nextStep: null,
        message: '❌ Không thể phân tích Gene sheet sau 3 lần thử.',
      };
    }
  }

  private async executeVariantSearchStep(
    pythonCode?: string,
    retryCount: number = 0,
  ) {
    try {
      // If no pythonCode provided, return simple search ready status
      if (!pythonCode) {
        return {
          success: true,
          stepName: 'variant_search',
          nextStep: null,
          message:
            '✅ Đã chuẩn bị search queries cho top biến thể. Bây giờ thực hiện web search.',
          searchReady: true,
          instruction:
            'Hãy sử dụng tool web_search_preview để tìm kiếm thông tin về các biến thể hàng đầu.',
        };
      }

      this.logger.log(
        'Executing LLM-generated variant search preparation code',
      );
      const result = await this.daytonaService.executePythonCode(pythonCode);

      if (result.exitCode === 0) {
        return {
          success: true,
          stepName: 'variant_search',
          result: result.result,
          nextStep: null,
          message:
            '✅ Đã chuẩn bị xong search queries. Bây giờ thực hiện web search.',
          searchReady: true,
          instruction:
            'Sử dụng web_search_preview để tìm kiếm thông tin về top biến thể.',
        };
      } else {
        throw new Error(`Variant search preparation failed: ${result.result}`);
      }
    } catch (error) {
      if (retryCount < 3) {
        return {
          success: false,
          stepName: 'variant_search',
          error: error.message,
          nextStep: 'variant_search',
          retryCount: retryCount + 1,
          message: `❌ Lỗi chuẩn bị search queries (lần ${retryCount + 1}). LLM cần generate code mới và thử lại...`,
        };
      }
      return {
        success: false,
        stepName: 'variant_search',
        error: error.message,
        nextStep: null,
        message: '❌ Không thể chuẩn bị search queries sau 3 lần thử.',
      };
    }
  }

  // ClickHouse related methods
  private async executeClickHouseExploration(
    action: 'list_tables' | 'describe_table',
    tableName?: string,
  ) {
    try {
      this.logger.log(`ClickHouse exploration: ${action}`);
      const database = 'default'; // Assuming default database for simplicity
      switch (action) {
        case 'list_tables':
          if (!database) {
            throw new Error('Thiếu thông tin database để tiếp tục khám phá');
          }
          const tablesResult = await this.clickHouseService.query(
            `SHOW TABLES FROM \`${database}\``,
          );
          return {
            success: true,
            action: 'list_tables',
            database,
            data: tablesResult.data || tablesResult,
            message: `Đã khám phá được các loại thông tin có sẵn trong hệ thống.`,
          };

        case 'describe_table':
          if (!database || !tableName) {
            throw new Error(
              'Thiếu thông tin để khám phá cấu trúc dữ liệu chi tiết',
            );
          }
          const describeResult = await this.clickHouseService.query(
            `DESCRIBE TABLE \`${database}\`.\`${tableName}\``,
          );
          return {
            success: true,
            action: 'describe_table',
            database,
            tableName,
            data: describeResult.data || describeResult,
            message: `Đã hiểu được cấu trúc dữ liệu để có thể tìm kiếm chính xác.`,
          };

        default:
          throw new Error(`Unknown action: ${action}`);
      }
    } catch (error) {
      this.logger.error(`ClickHouse exploration error: ${error.message}`);
      return {
        success: false,
        action,
        message: `Có lỗi xảy ra khi khám phá dữ liệu hệ thống. Vui lòng thử lại.`,
      };
    }
  }

  private async executePatientSearch(
    searchCriteria: {
      name?: string;
      citizenId?: string;
      gender?: string;
      dateOfBirth?: string;
      fromDob?: string;
      toDob?: string;
      minVisitCount?: number;
      maxVisitCount?: number;
      fromVisitDate?: string;
      toVisitDate?: string;
      limit?: number;
    },
    purpose: string,
    doctorId: number,
  ) {
    try {
      this.logger.log(`Patient search by doctor ${doctorId}: ${purpose}`);

      // Build WHERE conditions
      const conditions: string[] = [];

      // Always include doctor restriction
      conditions.push(
        `f.ProviderKey IN (SELECT ProviderKey FROM default.DimProvider WHERE DoctorId = ${doctorId})`,
      );

      if (searchCriteria.name) {
        conditions.push(
          `LOWER(p.FullName) LIKE LOWER('%${searchCriteria.name.replace(/'/g, "''")}%')`,
        );
      }

      if (searchCriteria.citizenId) {
        conditions.push(
          `p.citizenID = '${searchCriteria.citizenId.replace(/'/g, "''")}'`,
        );
      }

      if (searchCriteria.gender) {
        conditions.push(
          `p.Gender = '${searchCriteria.gender.replace(/'/g, "''")}'`,
        );
      }

      // Date of birth conditions
      if (searchCriteria.dateOfBirth) {
        conditions.push(`p.DateOfBirth = '${searchCriteria.dateOfBirth}'`);
      } else {
        if (searchCriteria.fromDob) {
          conditions.push(`p.DateOfBirth >= '${searchCriteria.fromDob}'`);
        }
        if (searchCriteria.toDob) {
          conditions.push(`p.DateOfBirth <= '${searchCriteria.toDob}'`);
        }
      }

      // Visit date range conditions
      if (searchCriteria.fromVisitDate || searchCriteria.toVisitDate) {
        const visitDateConditions: string[] = [];
        if (searchCriteria.fromVisitDate) {
          visitDateConditions.push(
            `f.DateReceived >= '${searchCriteria.fromVisitDate} 00:00:00'`,
          );
        }
        if (searchCriteria.toVisitDate) {
          visitDateConditions.push(
            `f.DateReceived <= '${searchCriteria.toVisitDate} 23:59:59'`,
          );
        }
        if (visitDateConditions.length > 0) {
          conditions.push(`(${visitDateConditions.join(' AND ')})`);
        }
      }

      const whereClause = conditions.join(' AND ');
      const limit = searchCriteria.limit || 20;

      // Build HAVING clause for visit count range
      const havingConditions: string[] = [];
      if (searchCriteria.minVisitCount) {
        havingConditions.push(
          `COUNT(f.PatientKey) >= ${searchCriteria.minVisitCount}`,
        );
      }
      if (searchCriteria.maxVisitCount) {
        havingConditions.push(
          `COUNT(f.PatientKey) <= ${searchCriteria.maxVisitCount}`,
        );
      }
      const havingClause =
        havingConditions.length > 0
          ? `HAVING ${havingConditions.join(' AND ')}`
          : '';

      // Build the optimized query
      const query = `
        SELECT 
          p.PatientKey,
          p.FullName,
          p.DateOfBirth,
          p.Gender,
          p.citizenID,
          p.Address,
          COUNT(f.PatientKey) as VisitCount,
          MIN(f.DateReceived) as FirstVisitDate,
          MAX(f.DateReceived) as LastVisitDate
        FROM default.DimPatient p
        LEFT JOIN default.FactGeneticTestResult f ON p.PatientKey = f.PatientKey
        WHERE ${whereClause}
        GROUP BY p.PatientKey, p.FullName, p.DateOfBirth, p.Gender, p.citizenID, p.Address
        ${havingClause}
        ORDER BY p.FullName
        LIMIT ${limit}
      `;

      // Execute the query
      const result = await this.clickHouseService.query(query);
      const patients = result.data || [];

      return {
        success: true,
        purpose,
        doctorId,
        searchCriteria,
        results: patients,
        totalFound: patients.length,
        message: `Đã tìm thấy ${patients.length} bệnh nhân phù hợp với tiêu chí tìm kiếm.`,
      };
    } catch (error) {
      this.logger.error(`Patient search error: ${error.message}`);
      return {
        success: false,
        purpose,
        doctorId,
        searchCriteria,
        error: error.message,
        message: `Có lỗi xảy ra khi tìm kiếm bệnh nhân. Vui lòng thử lại.`,
        suggestion: 'Hãy kiểm tra lại tiêu chí tìm kiếm',
      };
    }
  }

  private async executeCommonQuery(
    query: string,
    purpose: string,
    doctorId: number,
  ) {
    try {
      this.logger.log(`Common query by doctor ${doctorId}: ${purpose}`);

      // Validate query is SELECT only
      const trimmedQuery = query.trim().toUpperCase();
      if (!trimmedQuery.startsWith('SELECT')) {
        throw new Error(
          'Chỉ được phép thực hiện câu lệnh SELECT trong ClickHouse',
        );
      }

      // Check for dangerous operations
      const forbiddenOperations = [
        'INSERT',
        'UPDATE',
        'DELETE',
        'DROP',
        'CREATE',
        'ALTER',
        'TRUNCATE',
        'REPLACE',
        'MERGE',
        'OPTIMIZE',
        'SYSTEM',
        'ATTACH',
        'DETACH',
      ];

      for (const op of forbiddenOperations) {
        if (trimmedQuery.includes(op)) {
          throw new Error(
            `Không được phép sử dụng lệnh ${op} trong ClickHouse`,
          );
        }
      }

      // Execute the query directly - security is enforced through AI prompt
      const result = await this.clickHouseService.query(query);

      return {
        success: true,
        purpose,
        doctorId,
        query,
        data: result.data || result,
        rowCount: Array.isArray(result.data) ? result.data.length : 'unknown',
        message: `Đã thực hiện truy vấn ClickHouse thành công. Mục đích: ${purpose}`,
      };
    } catch (error) {
      this.logger.error(`ClickHouse query error: ${error.message}`);
      return {
        success: false,
        purpose,
        doctorId,
        query,
        error: error.message,
        message: `Có lỗi xảy ra khi thực hiện truy vấn ClickHouse. Vui lòng kiểm tra cú pháp SQL.`,
        suggestion:
          'Hãy kiểm tra lại cú pháp ClickHouse SQL hoặc điều kiện WHERE bảo mật',
      };
    }
  }

  private generateClinicalSearchQueries(
    queryType: string,
    searchTerm: string,
  ): string[] {
    const baseQueries = {
      variant: [
        `"${searchTerm}" clinical significance pathogenic database`,
        `"${searchTerm}" disease association mutation`,
        `"${searchTerm}" population frequency gnomad clinvar`,
      ],
      gene: [
        `"${searchTerm}" gene mutations disease association clinical`,
        `"${searchTerm}" pathogenic variants phenotype syndrome`,
        `"${searchTerm}" gene function clinical significance variants`,
        `compound heterozygous "${searchTerm}" disease risk`,
      ],
      phenotype: [
        `"${searchTerm}" genetic causes mutations genes`,
        `"${searchTerm}" syndrome genetic testing guidelines`,
        `"${searchTerm}" inheritance pattern genes variants`,
      ],
    };

    return (
      baseQueries[queryType] || [
        `"${searchTerm}" genetics clinical significance`,
        `"${searchTerm}" mutation disease association`,
      ]
    );
  }
}
