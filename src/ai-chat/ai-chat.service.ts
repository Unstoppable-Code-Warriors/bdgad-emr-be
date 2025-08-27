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
      model: openai.responses('gpt-4.1'),
      messages: [...createSystemDoctorMessages(user.id), ...messages],
      temperature: 0.3,
      maxOutputTokens: 2000,
      stopWhen: stepCountIs(10),
      tools: {
        web_search_preview: openai.tools.webSearchPreview({
          toModelOutput: (output) => {
            this.logger.log('Web search performed');
            return output;
          },
        }),
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
          - DimTestRun.EHR_url: cột chứa chi tiết hồ sơ y tế/thông tin y tế
          - FactGeneticTestResult: dữ liệu các lần khám
          - DimPatient: thông tin cơ bản bệnh nhân
          - DimProvider: thông tin bác sĩ và quyền truy cập
          
          PHÂN BIỆT LOCATION:
          - XÉT NGHIỆM: Location = 'bdgad' (kết quả xét nghiệm, lab tests)
          - HỒ SƠ Y TẾ: Location = 'pharmacy' (phiếu khám, chẩn đoán, đơn thuốc)
          - THẨM ĐỊNH: Location = 'test-result' (kết quả thẩm định, validation)
          
          LƯU Ý: KHÔNG đề cập đến các thuật ngữ Location này trong câu trả lời cho bác sĩ`,
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
          description: `Tìm kiếm và đếm số lượng bệnh nhân trong hệ thống EMR với nhiều tiêu chí linh hoạt.
          
          Sử dụng tool này khi:
          - Đếm tổng số bệnh nhân mà bác sĩ đang quản lý
          - Tìm kiếm, đếm số lượng bệnh nhân theo tiêu chí cụ thể
          - Tìm kiếm bệnh nhân theo tên, CMND, giới tính
          - Tìm theo độ tuổi (khoảng năm sinh)
          - Tìm theo số lần khám (khoảng từ X đến Y lần)
          - Tìm bệnh nhân có khám trong khoảng thời gian cụ thể
          - KHÔNG dùng khi cần xem chi tiết thông tin bệnh nhân
          
          XỬ LÝ THỜI GIAN ĐẶC BIỆT:
          - "tháng 8", "tháng 8 năm 2025" → fromVisitDate: "2025-08-01", toVisitDate: "2025-08-31"
          - "tháng này" → fromVisitDate: "2025-08-01", toVisitDate: "2025-08-31" (tháng hiện tại)
          - "năm nay", "2025" → fromVisitDate: "2025-01-01", toVisitDate: "2025-12-31"
          - "tuần này" → tính từ thứ 2 đến chủ nhật tuần hiện tại
          - "hôm nay" → fromVisitDate và toVisitDate cùng ngày hiện tại
          
          Các tính năng tìm kiếm:
          - Hỗ trợ khoảng ngày sinh (fromDob, toDob)
          - Hỗ trợ khoảng số lần khám (minVisitCount, maxVisitCount)  
          - Hỗ trợ khoảng thời gian khám (fromVisitDate, toVisitDate)
          - Có thể kết hợp nhiều điều kiện
          - Khi không có tiêu chí nào: trả về tổng số bệnh nhân đang quản lý
          
          LOGIC ĐẾM SỐ LẦN KHÁM:
          - Chỉ cần bác sĩ phụ trách bệnh nhân đó ít nhất 1 lần (bất kỳ Location nào) thì sẽ đếm toàn bộ số lần khám với Location = 'bdgad'
          - Số lần khám được đếm dựa trên TestRunKey (không phân biệt Location trong đếm)
          
          PHÂN BIỆT LOCATION:
          - XÉT NGHIỆM: Location = 'bdgad' (đây là những gì được đếm trong VisitCount)
          - HỒ SƠ Y TẾ: Location = 'pharmacy' (không được đếm trong VisitCount)
          - THẨM ĐỊNH: Location = 'test-result' (không được đếm trong VisitCount)
          
          TỰ ĐỘNG PHÁT HIỆN YÊU CẦU:
          - "tất cả bệnh nhân", "tất cả", "danh sách bệnh nhân" → tự động gọi tool với searchCriteria rỗng
          - "có bao nhiêu bệnh nhân", "đang quản lý bao nhiêu" → tự động gọi tool với searchCriteria rỗng, limit cao để đếm chính xác
          - "liệt kê bệnh nhân" → tự động gọi tool với searchCriteria rỗng
          - "bệnh nhân trong tháng 8" → fromVisitDate: "2025-08-01", toVisitDate: "2025-08-31"
          
          LƯU Ý VỀ LIMIT:
          - Khi ĐẾM SỐ LƯỢNG bệnh nhân: PHẢI để limit cao (ít nhất 100) để đảm bảo đếm chính xác
          - Khi CHỈ LIỆT KÊ: có thể dùng limit thấp hơn (20-50)
          - System sẽ tự động điều chỉnh limit nếu phát hiện purpose là đếm số lượng
          
          QUAN TRỌNG - CẤU TRÚC DỮ LIỆU TRẢ VỀ: 
          - Tool trả về SearchPatientsResult với cấu trúc chuẩn cho FE
          - results: Patient[] - mảng thông tin bệnh nhân (patientKey, fullName, dateOfBirth, gender, citizenID, address, lastTestDate, totalTests)
          - totalFound: number - tổng số bệnh nhân tìm được
          - success: boolean - trạng thái thành công
          - message: string - thông báo kết quả
          
          SAU KHI GỌI TOOL:
          - Hiển thị thông tin chi tiết của từng bệnh nhân (tên, ngày sinh, số lần khám)
          - KHÔNG chỉ đưa ra số lượng mà còn thông tin cụ thể
          - KHÔNG đề cập đến tên bảng, tên cột hay thuật ngữ kỹ thuật
          - KHÔNG đề cập đến các thuật ngữ Location như "bdgad", "pharmacy", "test-result"
          - Trả lời đơn giản, dễ hiểu cho bác sĩ
          - Ví dụ: "Tìm thấy X bệnh nhân: [danh sách tên, ngày sinh, số lần khám]"`,
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
                .describe(
                  'Giới hạn số lượng kết quả (mặc định 20). Khi ĐẾM SỐ LƯỢNG bệnh nhân, phải để limit cao (ít nhất 100) để đảm bảo đếm đủ tất cả bệnh nhân phù hợp.',
                ),
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

        // Tool để lấy hồ sơ sức khỏe chi tiết của bệnh nhân
        getPatientHealthRecords: tool({
          description: `Lấy thông tin chi tiết hồ sơ sức khỏe và lịch sử khám của bệnh nhân.
          
          Sử dụng tool này khi:
          - Bác sĩ muốn xem chi tiết hồ sơ sức khỏe của bệnh nhân
          - Cần xem lịch sử khám, kết quả xét nghiệm, chẩn đoán
          - Xem thông tin từ EHR_url (hồ sơ y tế điện tử)
          
          THÔNG TIN CÓ SẴN:
          - Thông tin cơ bản bệnh nhân (tên, ngày sinh, giới tính, CMND)
          - Lịch sử khám: ngày khám, loại xét nghiệm, kết quả
          - Hồ sơ y tế chi tiết từ EHR_url (JSON format)
          - Chẩn đoán, đơn thuốc, kết quả xét nghiệm
          - Thông tin validation và comment từ bác sĩ

          PHÂN BIỆT NGỮ CẢNH VÀ BỘ LỌC LOCATION:
          - Nếu bác sĩ hỏi về "lần xét nghiệm" hoặc "lần khám" → lọc Location = 'bdgad' (kết quả xét nghiệm)
          - Nếu bác sĩ hỏi về "hồ sơ y tế" hoặc "thông tin y tế" → lọc Location = 'pharmacy' (hồ sơ/phiếu khám theo chuẩn EMR)
          - Nếu không chỉ định rõ → trả về toàn bộ lịch sử theo quyền bác sĩ (không lọc Location)
          - Có thể set tham số recordType = 'exam' | 'medical' | 'validation' để chỉ định rõ ràng
          
          QUY TẮC PHÂN BIỆT:
          - XÉT NGHIỆM: Location = 'bdgad' (kết quả xét nghiệm, lab tests)
          - HỒ SƠ Y TẾ: Location = 'pharmacy' (phiếu khám, chẩn đoán, đơn thuốc)
          - THẨM ĐỊNH: Location = 'test-result' (kết quả thẩm định, validation)
          
          LOGIC QUYỀN TRUY CẬP:
          - Chỉ cần bác sĩ phụ trách bệnh nhân đó ít nhất 1 lần (bất kỳ Location nào) thì có thể xem toàn bộ thông tin
          - Quyền truy cập được kiểm tra ở cấp độ bệnh nhân, không phụ thuộc vào Location cụ thể
          
          WORKFLOW:
          - Bước 1: Gọi searchPatients để lấy danh sách và chọn bệnh nhân (lấy PatientKey)
          - Bước 2: Gọi tool này với PatientKey để lấy chi tiết hồ sơ
          - Có thể lọc theo loại thông tin bằng Location: xét nghiệm=bdgad, hồ sơ=pharmacy, thẩm định=test-result
          
          QUAN TRỌNG:
          - Tool này tự động áp dụng bảo mật theo DoctorId
          - Chỉ trả về thông tin bệnh nhân thuộc quyền quản lý của bác sĩ hiện tại
          - EHR_url chứa thông tin chi tiết nhất về hồ sơ y tế
          - KHÔNG trả về link S3, file path, hoặc URL nội bộ
          - KHÔNG đề cập đến các thuật ngữ Location như "bdgad", "pharmacy", "test-result"
          - Chỉ trả về thông tin y tế cần thiết cho bác sĩ`,
          inputSchema: z.object({
            patientKey: z
              .number()
              .describe(
                'PatientKey của bệnh nhân (lấy từ kết quả searchPatients)',
              ),
            recordType: z
              .enum(['exam', 'medical', 'validation'])
              .optional()
              .describe(
                "Lọc theo loại thông tin: 'exam'(xét nghiệm), 'medical'(hồ sơ), 'validation'(thẩm định)",
              ),
            countOnly: z
              .boolean()
              .optional()
              .default(false)
              .describe('Chỉ trả về số lượng bản ghi theo bộ lọc'),
            includeHistory: z
              .boolean()
              .optional()
              .default(true)
              .describe('Có bao gồm lịch sử khám chi tiết không'),
            purpose: z.string().describe('Mục đích xem hồ sơ (để logging)'),
          }),
          execute: async ({
            patientKey,
            recordType,
            countOnly,
            includeHistory,
            purpose,
          }) => {
            return await this.executeGetPatientHealthRecords(
              patientKey,
              includeHistory,
              recordType,
              countOnly ?? false,
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
          
          LOGIC QUYỀN TRUY CẬP:
          - Chỉ cần bác sĩ phụ trách bệnh nhân đó ít nhất 1 lần (bất kỳ Location nào) thì có thể xem toàn bộ thông tin
          - Quyền truy cập được kiểm tra ở cấp độ bệnh nhân, không phụ thuộc vào Location cụ thể
          
          PHÂN BIỆT LOCATION TRONG TRUY VẤN:
          - XÉT NGHIỆM: Location = 'bdgad' (kết quả xét nghiệm, lab tests)
          - HỒ SƠ Y TẾ: Location = 'pharmacy' (phiếu khám, chẩn đoán, đơn thuốc)
          - THẨM ĐỊNH: Location = 'test-result' (kết quả thẩm định, validation)
          - Khi cần đếm số lần xét nghiệm: chỉ lấy Location = 'bdgad'
          - Khi cần xem hồ sơ y tế: chỉ lấy Location = 'pharmacy'
          
          QUAN TRỌNG - Quy tắc bảo mật và cú pháp:
          - CHỈ được phép thực hiện câu lệnh SELECT (ClickHouse SQL)
          - BẮT BUỘC: Luôn luôn PHẢI có điều kiện WHERE để giới hạn dữ liệu chỉ cho bác sĩ hiện tại
          - Cú pháp bảo mật: WHERE EXISTS (SELECT 1 FROM default.DimProvider dp WHERE dp.ProviderKey = [table].ProviderKey AND dp.DoctorId = ${user.id})
          - HOẶC: WHERE [table].ProviderKey IN (SELECT ProviderKey FROM default.DimProvider WHERE DoctorId = ${user.id})
          - Sử dụng cú pháp ClickHouse: backticks cho table/column names, toDate(), formatDateTime(), etc.
          - Database prefix: default.TableName
          - Không được thiếu điều kiện bảo mật trong bất kỳ truy vấn nào
          - KHÔNG đề cập đến các thuật ngữ Location như "bdgad", "pharmacy", "test-result" trong câu trả lời`,
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
      maxOutputTokens: 1000, // Reduced to prevent excessive output
      stopWhen: stepCountIs(4),
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

        // STEP 1: Explore Gene sheet structure
        exploreFileStructure: tool({
          description: `BƯỚC 1: Khám phá Gene sheet trong file Excel openCRAVAT.
          
          Mục tiêu:
          - Xác định sheet có tên chứa 'Gene' (không phân biệt hoa thường) hoặc sheet phù hợp nhất
          - Lấy danh sách các cột, số dòng, các cột gợi ý có chứa 'gene' và 'count'
          - In ra duy nhất 1 dòng đánh dấu: GENE_SHEET_INFO_JSON: { ... } để bước 2 dùng
          
          Kết quả trả về sẽ bao gồm cấu trúc Gene sheet để LLM tạo Python cho bước 2.`,
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
          description: `BƯỚC 2: Phân tích bảng Gene sheet để xác định top 3 biến thể xuất hiện nhiều nhất.
          Yêu cầu:
          - Trong code Python, tải file excel từ url ${excelFilePath}
          Tập trung vào:
          - Bỏ qua row đầu tiên (headers)
          - Cột A: tên biến thể (gene/variant)
          - Cột C: dữ liệu hỗ trợ xác định mức độ phổ biến
          - Xác định top 3 biến thể xuất hiện nhiều nhất
          
          Output: danh sách top 3 biến thể xuất hiện nhiều nhất`,
          inputSchema: z.object({
            retryCount: z
              .number()
              .optional()
              .default(0)
              .describe('Số lần retry nếu có lỗi'),
          }),
          execute: async ({ retryCount = 0 }) => {
            this.logger.log(
              `Running internal gene analysis step, retry: ${retryCount}`,
            );
            return await this.executeGeneStrategyStep(
              retryCount,
              excelFilePath,
            );
          },
        }),

        // STEP 3: Prepare search queries for top variants
        prepareVariantSearch: tool({
          description: `BƯỚC 3: Chuẩn bị search queries cho top 3 biến thể xuất hiện nhiều nhất.
          
          Dựa vào kết quả từ bước 2:
          - Nhận mảng tên 3 biến thể phổ biến nhất
          - Tạo search queries từ template cố định, tập trung clinical significance và disease associations
          - Không thực thi Python ở bước này
          
          Input: Top 3 variants list từ bước 2`,
          inputSchema: z.object({
            variants: z
              .array(z.string())
              .min(1)
              .max(3)
              .describe('Danh sách 1-3 biến thể phổ biến nhất lấy từ bước 2'),
            retryCount: z
              .number()
              .optional()
              .default(0)
              .describe('Số lần retry nếu có lỗi'),
          }),
          execute: async ({ variants }) => {
            this.logger.log(
              `Preparing fixed-template search queries for variants`,
            );
            const queries = this.generateVariantSearchQueries(variants);
            return {
              success: true,
              stepName: 'variant_search',
              nextStep: null,
              message:
                '✅ Đã chuẩn bị xong search queries cho top biến thể. Bây giờ thực hiện web search.',
              searchReady: true,
              queries,
              instruction:
                'Sử dụng web_search_preview để tìm kiếm thông tin về các biến thể với truy vấn đã tạo.',
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
# BƯỚC 1: KHÁM PHÁ GENE SHEET
import pandas as pd
import numpy as np
import json
import requests
import tempfile
import os

excel_file_path = "${excelFilePath || ''}"
print("🔍 BƯỚC 1: KHÁM PHÁ GENE SHEET")
print(f"📂 File: {excel_file_path}")

def download_if_url(path: str) -> str:
    if path.startswith('http://') or path.startswith('https://'):
        r = requests.get(path, timeout=60)
        r.raise_for_status()
        tmp = tempfile.NamedTemporaryFile(suffix='.xlsx', delete=False)
        tmp.write(r.content)
        tmp.flush()
        tmp.close()
        return tmp.name
    return path

def find_gene_sheet(xls: pd.ExcelFile) -> str:
    for s in xls.sheet_names:
        if 'gene' in str(s).lower():
            return s
    return xls.sheet_names[0]

tmp_path = None
try:
    tmp_path = download_if_url(excel_file_path)
    xls = pd.ExcelFile(tmp_path)
    sheet_name = find_gene_sheet(xls)
    df = pd.read_excel(tmp_path, sheet_name=sheet_name, header=1)

    columns = [str(c) for c in df.columns]
    rows = int(len(df))

    gene_like = [c for c in columns if 'gene' in c.lower() or 'variant' in c.lower()]
    count_like = [c for c in columns if 'count' in c.lower() or c.lower() in {'c'}]

    info = {
        'sheet_name': sheet_name,
        'rows': rows,
        'columns': columns,
        'candidate_gene_columns': gene_like,
        'candidate_count_columns': count_like,
    }

    print('GENE_SHEET_INFO_JSON: ' + json.dumps(info, ensure_ascii=False))

except Exception as e:
    print(f"❌ Error exploring Gene sheet: {e}")
    raise
finally:
    if tmp_path and tmp_path != excel_file_path and os.path.exists(tmp_path):
        try:
            os.remove(tmp_path)
        except Exception:
            pass
`;

      const result = await this.daytonaService.executePythonCode(exploreCode);

      if (result.exitCode === 0) {
        const geneSheetInfo = this.parseGeneSheetInfoFromPythonOutput(
          result.result,
        );
        return {
          success: true,
          stepName: 'explore',
          result: result.result,
          geneSheetInfo,
          nextStep: 'gene_analysis',
          message:
            '✅ Đã khám phá Gene sheet. Tiếp theo: LLM tạo code để lấy top biến thể.',
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
          message: `❌ Lỗi khám phá Gene sheet (lần ${retryCount + 1}). Đang thử lại...`,
        };
      }
      return {
        success: false,
        stepName: 'explore',
        error: error.message,
        nextStep: null,
        message: '❌ Không thể khám phá Gene sheet sau 3 lần thử.',
      };
    }
  }

  private async executeGeneStrategyStep(
    retryCount: number = 0,
    excelFilePath?: string,
  ) {
    try {
      // Build internal deterministic Python if no code provided
      const code = `
# STEP 2: Gene sheet analysis — print TOP_VARIANTS_JSON
import pandas as pd
import numpy as np
import json
import requests
import tempfile
import os

EXCEL_URL = "${excelFilePath || ''}"

def download_if_url(path: str) -> str:
    if path.startswith('http://') or path.startswith('https://'):
        r = requests.get(path, timeout=60)
        r.raise_for_status()
        tmp = tempfile.NamedTemporaryFile(suffix='.xlsx', delete=False)
        tmp.write(r.content)
        tmp.flush()
        tmp.close()
        return tmp.name
    return path

def find_gene_sheet(xls: pd.ExcelFile) -> str:
    for s in xls.sheet_names:
        if 'gene' in str(s).lower():
            return s
    return xls.sheet_names[0]

local_path = None
try:
    local_path = download_if_url(EXCEL_URL)
    xls = pd.ExcelFile(local_path)
    sheet_name = find_gene_sheet(xls)
    df = pd.read_excel(local_path, sheet_name=sheet_name, header=1)

    # Use columns by position: A (0) as variant, C (2) as count-like
    variant_col = df.columns[0]
    count_col = df.columns[2] if len(df.columns) > 2 else df.columns[-1]

    data = df[[variant_col, count_col]].copy()
    data.columns = ['variant', 'count']
    data['variant'] = data['variant'].astype(str).str.strip()

    numeric = pd.to_numeric(data['count'], errors='ignore')
    if str(numeric.dtype) == 'object':
        # fallback: count each occurrence
        data['ones'] = 1
        agg = data.groupby('variant', dropna=False)['ones'].sum()
    else:
        data['count_num'] = pd.to_numeric(data['count'], errors='coerce').fillna(0)
        agg = data.groupby('variant', dropna=False)['count_num'].sum()

    agg = agg.sort_values(ascending=False)
    top_variants = [str(v) for v in agg.head(3).index if isinstance(v, (str, int, float))]
    top_variants = [v for v in top_variants if v and v.lower() not in {'nan', 'none'}][:3]

    print('TOP_VARIANTS_JSON: ' + json.dumps(top_variants, ensure_ascii=False))

except Exception as e:
    print(f"❌ Error in gene analysis: {e}")
    raise
finally:
    if local_path and local_path != EXCEL_URL and os.path.exists(local_path):
        try:
            os.remove(local_path)
        except Exception:
            pass
`;

      this.logger.log('Executing internal gene analysis Python code');
      const result = await this.daytonaService.executePythonCode(code);

      if (result.exitCode === 0) {
        const variants = this.parseTopVariantsFromPythonOutput(result.result);
        if (!variants || variants.length === 0) {
          throw new Error(
            'Không trích xuất được TOP_VARIANTS_JSON từ output Python. Vui lòng đảm bảo in ra: TOP_VARIANTS_JSON: ["variant1", "variant2", "variant3"]',
          );
        }
        return {
          success: true,
          stepName: 'gene_analysis',
          result: result.result,
          variants,
          nextStep: 'variant_search',
          message:
            '✅ Đã phân tích Gene sheet và xác định top 3 biến thể xuất hiện nhiều nhất. Tiếp theo: chuẩn bị search queries.',
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
          message: `❌ Lỗi phân tích Gene sheet (lần ${retryCount + 1}). Đang thử lại...`,
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
            '✅ Đã chuẩn bị search queries cho top 3 biến thể. Bây giờ thực hiện web search.',
          searchReady: true,
          instruction:
            'Hãy sử dụng tool web_search_preview để tìm kiếm thông tin về top 3 biến thể xuất hiện nhiều nhất.',
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
            '✅ Đã chuẩn bị xong search queries cho top 3 biến thể. Bây giờ thực hiện web search.',
          searchReady: true,
          instruction:
            'Sử dụng web_search_preview để tìm kiếm thông tin về top 3 biến thể xuất hiện nhiều nhất.',
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
      this.logger.log(`=== Patient search START ===`);
      this.logger.log(`Doctor ID: ${doctorId}`);
      this.logger.log(`Purpose: ${purpose}`);
      this.logger.log(
        `Search criteria:`,
        JSON.stringify(searchCriteria, null, 2),
      );
      this.logger.log(
        `AI input contains fromVisitDate: ${!!searchCriteria.fromVisitDate}`,
      );
      this.logger.log(
        `AI input contains toVisitDate: ${!!searchCriteria.toVisitDate}`,
      );

      const limit = searchCriteria.limit || 20;
      const offset = 0; // For simplicity, not implementing pagination in AI chat

      // Auto-adjust limit for counting purposes
      const isCountingPurpose =
        purpose.toLowerCase().includes('đếm') ||
        purpose.toLowerCase().includes('bao nhiêu') ||
        purpose.toLowerCase().includes('count');

      let finalLimit = limit;
      if (isCountingPurpose && limit < 100) {
        finalLimit = 1000; // Use high limit for accurate counting
        this.logger.log(
          `Auto-adjusted limit from ${limit} to ${finalLimit} for counting purpose`,
        );
      }

      this.logger.log(
        `Final limit: ${finalLimit}, Counting purpose: ${isCountingPurpose}`,
      );

      // Build WHERE conditions for filtering
      const filterConditions: string[] = [];
      const patientFilterConditions: string[] = []; // For patient-level filters
      const testFilterConditions: string[] = []; // For test-level filters
      const queryParams: Record<string, any> = { doctorId };

      this.logger.log(`=== Building filter conditions ===`);

      if (searchCriteria.name) {
        patientFilterConditions.push('p.FullName ILIKE {name:String}');
        queryParams.name = `%${searchCriteria.name}%`;
        this.logger.log(`Added name filter: ${queryParams.name}`);
      }

      if (searchCriteria.citizenId) {
        // Handle citizenId as part of latest_patient_data CTE like PatientService
        queryParams.citizenid = searchCriteria.citizenId;
        this.logger.log(`Added citizenId filter: ${queryParams.citizenid}`);
      }

      if (searchCriteria.gender) {
        patientFilterConditions.push('p.Gender = {gender:String}');
        queryParams.gender = searchCriteria.gender;
        this.logger.log(`Added gender filter: ${queryParams.gender}`);
      }

      // Date range filters for test dates
      if (searchCriteria.fromVisitDate) {
        try {
          const dateFrom = new Date(searchCriteria.fromVisitDate)
            .toISOString()
            .split('T')[0];
          testFilterConditions.push('f.DateReceived >= {dateFrom:Date}');
          queryParams.dateFrom = dateFrom;
          this.logger.log(`Added fromVisitDate filter: ${dateFrom}`);
        } catch (error) {
          this.logger.error(
            `Invalid fromVisitDate format: ${searchCriteria.fromVisitDate}`,
          );
          throw new Error(
            `Invalid fromVisitDate format: ${searchCriteria.fromVisitDate}`,
          );
        }
      }

      if (searchCriteria.toVisitDate) {
        try {
          const dateTo = new Date(searchCriteria.toVisitDate)
            .toISOString()
            .split('T')[0];
          testFilterConditions.push('f.DateReceived <= {dateTo:Date}');
          queryParams.dateTo = dateTo;
          this.logger.log(`Added toVisitDate filter: ${dateTo}`);
        } catch (error) {
          this.logger.error(
            `Invalid toVisitDate format: ${searchCriteria.toVisitDate}`,
          );
          throw new Error(
            `Invalid toVisitDate format: ${searchCriteria.toVisitDate}`,
          );
        }
      }

      // Date of birth filters - handle both single date and range
      if (searchCriteria.dateOfBirth) {
        patientFilterConditions.push('p.DateOfBirth = {dateOfBirth:Date}');
        queryParams.dateOfBirth = searchCriteria.dateOfBirth;
        this.logger.log(`Added dateOfBirth filter: ${queryParams.dateOfBirth}`);
      } else {
        if (searchCriteria.fromDob) {
          patientFilterConditions.push('p.DateOfBirth >= {fromDob:Date}');
          queryParams.fromDob = searchCriteria.fromDob;
          this.logger.log(`Added fromDob filter: ${queryParams.fromDob}`);
        }
        if (searchCriteria.toDob) {
          patientFilterConditions.push('p.DateOfBirth <= {toDob:Date}');
          queryParams.toDob = searchCriteria.toDob;
          this.logger.log(`Added toDob filter: ${queryParams.toDob}`);
        }
      }

      // Handle month filter specially - need to extract year and month
      // Check for month filter patterns
      let isMonthFilter = false;
      let year: number | null = null;
      let month: number | null = null;

      if (searchCriteria.fromVisitDate && searchCriteria.toVisitDate) {
        // Check if this looks like a month search (same month, first to last day)
        const fromDate = new Date(searchCriteria.fromVisitDate);
        const toDate = new Date(searchCriteria.toVisitDate);

        if (
          fromDate.getMonth() === toDate.getMonth() &&
          fromDate.getFullYear() === toDate.getFullYear() &&
          fromDate.getDate() === 1 &&
          toDate.getDate() ===
            new Date(toDate.getFullYear(), toDate.getMonth() + 1, 0).getDate()
        ) {
          isMonthFilter = true;
          year = fromDate.getFullYear();
          month = fromDate.getMonth() + 1;
          this.logger.log(`Detected month search pattern 1: ${year}-${month}`);
        }
      } else if (searchCriteria.fromVisitDate || searchCriteria.toVisitDate) {
        // Check if either date suggests a specific month/year pattern
        const dateStr =
          searchCriteria.fromVisitDate || searchCriteria.toVisitDate;
        if (dateStr) {
          const date = new Date(dateStr);

          // If the date is first or last day of month, assume month filter
          if (
            date.getDate() === 1 ||
            date.getDate() ===
              new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate()
          ) {
            isMonthFilter = true;
            year = date.getFullYear();
            month = date.getMonth() + 1;
            this.logger.log(
              `Detected month search pattern 2: ${year}-${month} from ${dateStr}`,
            );
          }
        }
      }

      if (isMonthFilter && year && month) {
        this.logger.log(`Converting to month filter: ${year}-${month}`);
        this.logger.log(
          `testFilterConditions before removal:`,
          testFilterConditions,
        );
        this.logger.log(
          `queryParams before removal:`,
          JSON.stringify(queryParams, null, 2),
        );

        // Remove any existing date range filters from testFilterConditions
        // Use while loop to ensure all matching filters are removed
        let index = testFilterConditions.findIndex((f) =>
          f.includes('f.DateReceived >='),
        );
        while (index !== -1) {
          testFilterConditions.splice(index, 1);
          this.logger.log(
            `Removed dateFrom filter from testFilterConditions at index ${index}`,
          );
          index = testFilterConditions.findIndex((f) =>
            f.includes('f.DateReceived >='),
          );
        }

        index = testFilterConditions.findIndex((f) =>
          f.includes('f.DateReceived <='),
        );
        while (index !== -1) {
          testFilterConditions.splice(index, 1);
          this.logger.log(
            `Removed dateTo filter from testFilterConditions at index ${index}`,
          );
          index = testFilterConditions.findIndex((f) =>
            f.includes('f.DateReceived <='),
          );
        }

        // Clean up date parameters BEFORE adding new ones
        delete queryParams.dateFrom;
        delete queryParams.dateTo;

        // Add month/year filters
        testFilterConditions.push(
          'toYear(f.DateReceived) = {visitYear:UInt32}',
        );
        testFilterConditions.push(
          'toMonth(f.DateReceived) = {visitMonth:UInt32}',
        );

        queryParams.visitYear = year;
        queryParams.visitMonth = month;

        this.logger.log(
          `testFilterConditions after cleanup:`,
          testFilterConditions,
        );
        this.logger.log(
          `Final queryParams after month conversion:`,
          JSON.stringify(queryParams, null, 2),
        );
      }

      // citizenID filter will be handled separately in the latest_patient_data CTE
      // Build filter WHERE clauses AFTER month detection
      const patientFilters =
        patientFilterConditions.length > 0
          ? `AND ${patientFilterConditions.join(' AND ')}`
          : '';

      const testFilters =
        testFilterConditions.length > 0
          ? `AND ${testFilterConditions.join(' AND ')}`
          : '';

      this.logger.log(`=== Final filter conditions ===`);
      this.logger.log(`Patient filters: ${patientFilters}`);
      this.logger.log(`Test filters: ${testFilters}`);
      this.logger.log(`Query params:`, JSON.stringify(queryParams, null, 2));

      // Use same CTE structure as PatientService for consistency
      const searchQuery = `
        WITH latest_patient_data AS (
          SELECT PatientKey, FullName, DateOfBirth, Gender, Barcode, Address, citizenID,
                 ROW_NUMBER() OVER (PARTITION BY PatientKey ORDER BY EndDate DESC) as rn
          FROM DimPatient p
          WHERE IsCurrent = 1
          ${searchCriteria.citizenId ? `AND citizenID = {citizenid:String}` : ''}
          ${patientFilters}
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
          ${testFilters}
        )
        SELECT DISTINCT
          p.PatientKey as patientKey,
          p.FullName as fullName,
          p.DateOfBirth as dateOfBirth,
          p.Gender as gender,
          p.Barcode as barcode,
          p.Address as address,
          p.citizenID as citizenID,
          MAX(f_all.DateReceived) as lastTestDate,
          COUNT(f_all.TestKey) as totalTests,
          ft.DoctorName as doctorName
        FROM filtered_tests ft
        JOIN latest_patient_data p ON ft.PatientKey = p.PatientKey AND p.rn = 1
        JOIN FactGeneticTestResult f_all ON ft.PatientKey = f_all.PatientKey
        GROUP BY 
          p.PatientKey, p.FullName, p.DateOfBirth, p.Gender, 
          p.Barcode, p.Address, p.citizenID, ft.DoctorName
        ORDER BY p.FullName
        LIMIT {limit:UInt32}
      `;

      queryParams.limit = finalLimit;

      this.logger.log(`=== Executing query ===`);
      this.logger.log(`Query:`, searchQuery);
      this.logger.log(`Params:`, JSON.stringify(queryParams, null, 2));

      // Execute the query using same approach as PatientService
      const result = await this.clickHouseService.query(
        searchQuery,
        queryParams,
      );
      const patients = result.data || [];

      this.logger.log(`=== Query result ===`);
      this.logger.log(`Raw result:`, JSON.stringify(result, null, 2));
      this.logger.log(`Patients found: ${patients.length}`);
      if (patients.length > 0) {
        this.logger.log(
          `First patient sample:`,
          JSON.stringify(patients[0], null, 2),
        );
      }

      // Apply visit count filtering after query if specified (since it's complex to handle in ClickHouse)
      let filteredPatients = patients;
      if (searchCriteria.minVisitCount || searchCriteria.maxVisitCount) {
        this.logger.log(`=== Applying visit count filter ===`);
        this.logger.log(
          `Min visits: ${searchCriteria.minVisitCount}, Max visits: ${searchCriteria.maxVisitCount}`,
        );

        filteredPatients = patients.filter((patient: any) => {
          const visitCount = patient.totalTests || 0;
          if (
            searchCriteria.minVisitCount &&
            visitCount < searchCriteria.minVisitCount
          ) {
            return false;
          }
          if (
            searchCriteria.maxVisitCount &&
            visitCount > searchCriteria.maxVisitCount
          ) {
            return false;
          }
          return true;
        });

        this.logger.log(
          `After visit count filter: ${filteredPatients.length} patients`,
        );
      }

      this.logger.log(`=== Final result ===`);
      this.logger.log(`Total found: ${filteredPatients.length}`);

      // Format patients data to match FE expected structure
      const formattedPatients = filteredPatients.map((patient: any) => ({
        patientKey: patient.patientKey,
        fullName: patient.fullName,
        dateOfBirth: patient.dateOfBirth,
        gender: patient.gender,
        citizenID: patient.citizenID,
        address: patient.address,
        lastTestDate: patient.lastTestDate,
        totalTests: patient.totalTests,
      }));

      // Clean searchCriteria to match FE type (remove extra fields)
      const cleanSearchCriteria = {
        name: searchCriteria.name,
        citizenId: searchCriteria.citizenId,
        gender: searchCriteria.gender,
        dateOfBirth: searchCriteria.dateOfBirth,
        limit: searchCriteria.limit,
      };

      return {
        success: true,
        purpose,
        doctorId,
        searchCriteria: cleanSearchCriteria,
        results: formattedPatients,
        totalFound: filteredPatients.length,
        message: `Đã tìm thấy ${filteredPatients.length} bệnh nhân phù hợp với tiêu chí tìm kiếm.`,
      };
    } catch (error) {
      this.logger.error(`=== Patient search ERROR ===`);
      this.logger.error(`Error message: ${error.message}`);
      this.logger.error(`Error stack:`, error.stack);

      // Clean searchCriteria to match FE type even in error case
      const cleanSearchCriteria = {
        name: searchCriteria.name,
        citizenId: searchCriteria.citizenId,
        gender: searchCriteria.gender,
        dateOfBirth: searchCriteria.dateOfBirth,
        limit: searchCriteria.limit,
      };

      return {
        success: false,
        purpose,
        doctorId,
        searchCriteria: cleanSearchCriteria,
        results: [],
        totalFound: 0,
        message: `Có lỗi xảy ra khi tìm kiếm bệnh nhân. Vui lòng thử lại.`,
      };
    }
  }

  private async executeGetPatientHealthRecords(
    patientKey: number,
    includeHistory: boolean,
    recordType: 'exam' | 'medical' | 'validation' | undefined,
    countOnly: boolean,
    purpose: string,
    doctorId: number,
  ) {
    try {
      this.logger.log(
        `Getting patient health records by doctor ${doctorId}: ${purpose}`,
      );

      // Input already has patientKey resolved from searchPatients

      // Authorize: doctor can see full history if they have at least 1 record with this patient (any location)
      const authQuery = `
        SELECT count() AS c
        FROM default.FactGeneticTestResult f
        INNER JOIN default.DimProvider dp ON f.ProviderKey = dp.ProviderKey
        WHERE f.PatientKey = ${patientKey} AND dp.DoctorId = ${doctorId}
        LIMIT 1
      `;
      const authResult = await this.clickHouseService.query(authQuery);
      const authorizedCount =
        Array.isArray(authResult.data) && authResult.data[0]?.c !== undefined
          ? Number(authResult.data[0].c)
          : 0;
      if (authorizedCount === 0) {
        return {
          success: false,
          purpose,
          doctorId,
          patientKey,
          message:
            'Bạn chưa từng phụ trách bệnh nhân này nên không có quyền xem lịch sử đầy đủ.',
          suggestion:
            'Chỉ xem được bệnh nhân do bạn phụ trách ít nhất một lần.',
        };
      }

      // Determine optional Location filter by recordType (normalized)
      const locationByType: Record<string, string> = {
        exam: 'bdgad',
        medical: 'pharmacy',
        validation: 'test-result',
      };
      const targetLocation = recordType
        ? locationByType[recordType]
        : undefined;
      const locationFilter = targetLocation
        ? "AND lower(trim(BOTH ' ' FROM f.Location)) = '" + targetLocation + "'"
        : '';

      // Build the query to get patient health records (use PatientKey, full history, no per-row DoctorId filter)
      const query = `
        SELECT 
          p.PatientKey,
          p.FullName,
          p.DateOfBirth,
          p.Gender,
          p.citizenID,
          p.Address,
          argMax(f.DateReceived, f.DateReceived) as DateReceived,
          argMax(f.Location, f.DateReceived) as VisitLocation,
          argMax(dt.TestRunKey, f.DateReceived) as TestRunKey,
          argMax(dt.CaseID, f.DateReceived) as CaseID,
          argMax(dt.EHR_url, f.DateReceived) as EHR_url,
          argMax(dt.result_etl_url, f.DateReceived) as result_etl_url,
          argMax(dt.htmlResult, f.DateReceived) as htmlResult,
          argMax(dt.excelResult, f.DateReceived) as excelResult,
          argMax(dt.commentResult, f.DateReceived) as commentResult,
          argMax(t.TestName, f.DateReceived) as TestName,
          argMax(t.TestCategory, f.DateReceived) as TestCategory,
          argMax(d.DiagnosisDescription, f.DateReceived) as DiagnosisDescription
        FROM default.DimPatient p
        INNER JOIN default.FactGeneticTestResult f ON p.PatientKey = f.PatientKey
        LEFT JOIN default.DimTestRun dt ON f.TestRunKey = dt.TestRunKey
        LEFT JOIN default.DimTest t ON f.TestKey = t.TestKey
        LEFT JOIN default.DimDiagnosis d ON f.DiagnosisKey = d.DiagnosisKey
        WHERE p.PatientKey = ${patientKey}
          ${locationFilter}
        GROUP BY 
          p.PatientKey, p.FullName, p.DateOfBirth, p.Gender, p.citizenID, p.Address,
          f.TestRunKey, f.Location
        ORDER BY DateReceived DESC
      `;

      // Execute the query
      const result = await this.clickHouseService.query(query);
      const records = result.data || [];

      if (records.length === 0) {
        return {
          success: false,
          purpose,
          doctorId,
          patientKey,
          message:
            'Không tìm thấy hồ sơ phù hợp theo bộ lọc đã chọn hoặc bệnh nhân không thuộc quyền quản lý của bạn.',
          suggestion: 'Hãy kiểm tra lại bộ lọc hoặc thông tin bệnh nhân',
        };
      }

      // Process EHR_url data if available - EXCLUDE S3 links and file paths
      const processedRecords = records.map((record: any) => {
        let ehrData: any = null;
        if (record.EHR_url) {
          try {
            ehrData = JSON.parse(record.EHR_url);
          } catch (e) {
            ehrData = { raw: record.EHR_url };
          }
        }

        // Clean and extract only medical information, exclude file paths and S3 links
        const cleanEhrData = this.cleanEhrDataForDoctor(ehrData);

        return {
          // Basic patient info
          PatientKey: record.PatientKey,
          FullName: record.FullName,
          DateOfBirth: record.DateOfBirth,
          Gender: record.Gender,
          citizenID: record.citizenID,
          Address: record.Address,

          // Visit info
          VisitDate: record.DateReceived,
          VisitLocation: record.VisitLocation,
          TestName: record.TestName,
          TestCategory: record.TestCategory,
          DiagnosisDescription: record.DiagnosisDescription,

          // Clean EHR data (no file paths)
          ehrData: cleanEhrData,

          // Extract key medical information
          appointmentInfo: cleanEhrData?.appointment || null,
          patientInfo: cleanEhrData?.patient || null,
          medicalRecord: cleanEhrData?.medical_record || null,
          labTests: cleanEhrData?.lab_tests || null,
          prescription: cleanEhrData?.prescription || null,

          // Comments
          commentResult: record.commentResult,
        };
      });

      // Patient summary
      const patientSummary = {
        patientKey: records[0].PatientKey,
        fullName: records[0].FullName,
        dateOfBirth: records[0].DateOfBirth,
        gender: records[0].Gender,
        citizenId: records[0].citizenID,
        address: records[0].Address,
        totalVisits: records.length,
        firstVisit: records[records.length - 1]?.DateReceived,
        lastVisit: records[0]?.DateReceived,
      };

      if (countOnly) {
        return {
          success: true,
          purpose,
          doctorId,
          patientKey,
          patient: patientSummary,
          recordType,
          location: targetLocation,
          total: records.length,
          message: `Tìm thấy ${records.length} lần${recordType ? ` cho loại '${recordType}'` : ''}.`,
        };
      }

      return {
        success: true,
        purpose,
        doctorId,
        patientKey,
        patientSummary,
        healthRecords: includeHistory ? processedRecords : [],
        totalRecords: records.length,
        message: `Đã tìm thấy ${records.length} lần khám của bệnh nhân ${patientSummary.fullName}${recordType ? ` (lọc theo '${recordType}')` : ''}.`,
        note: 'Thông tin chi tiết hồ sơ y tế đã được làm sạch, loại bỏ link S3 và file path. Chỉ hiển thị thông tin y tế cần thiết cho bác sĩ.',
      };
    } catch (error) {
      this.logger.error(`Get patient health records error: ${error.message}`);
      return {
        success: false,
        purpose,
        doctorId,
        patientKey,
        error: error.message,
        message: `Có lỗi xảy ra khi lấy hồ sơ sức khỏe bệnh nhân. Vui lòng thử lại.`,
        suggestion: 'Hãy kiểm tra lại thông tin bệnh nhân',
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

  /**
   * Count records by type (exam/medical/validation) for a given patient, with joins and EHR summary
   */
  private async executeCountPatientRecords(
    patientIdentifier: { patientName?: string; citizenId?: string },
    recordType: 'exam' | 'medical' | 'validation',
    includeList: boolean,
    purpose: string,
    doctorId: number,
  ) {
    try {
      this.logger.log(
        `Count patient records by type for doctor ${doctorId}: ${purpose}`,
      );

      if (!patientIdentifier.patientName && !patientIdentifier.citizenId) {
        throw new Error('Cần cung cấp tên hoặc CMND của bệnh nhân để đếm');
      }

      // Determine location filter
      const locationByType: Record<string, string> = {
        exam: 'bdgad',
        medical: 'pharmacy',
        validation: 'test-result',
      };
      const targetLocation = locationByType[recordType];

      // Step 1: find patient(s)
      const patientConds: string[] = [];
      if (patientIdentifier.patientName) {
        patientConds.push(
          `lowerUTF8(p.FullName) LIKE lowerUTF8('%${patientIdentifier.patientName.replace(/'/g, "''")}%')`,
        );
      }
      if (patientIdentifier.citizenId) {
        patientConds.push(
          `p.citizenID = '${patientIdentifier.citizenId.replace(/'/g, "''")}'`,
        );
      }

      const patientQuery = `
        SELECT p.PatientKey, p.FullName, p.DateOfBirth, p.Gender, p.citizenID
        FROM default.DimPatient p
        WHERE ${patientConds.join(' OR ')}
        LIMIT 5
      `;

      const patientResult = await this.clickHouseService.query(patientQuery);
      const patients: any[] = patientResult.data || [];

      if (patients.length === 0) {
        return {
          success: false,
          purpose,
          doctorId,
          patientIdentifier,
          message: 'Không tìm thấy bệnh nhân phù hợp.',
          needDisambiguation: false,
        };
      }

      if (patients.length > 1 && !patientIdentifier.citizenId) {
        return {
          success: false,
          purpose,
          doctorId,
          patientIdentifier,
          message:
            'Có nhiều bệnh nhân trùng tên. Vui lòng cung cấp CMND hoặc chi tiết hơn.',
          needDisambiguation: true,
          candidates: patients.map((p) => ({
            patientKey: p.PatientKey,
            fullName: p.FullName,
            dateOfBirth: p.DateOfBirth,
            gender: p.Gender,
            citizenId: p.citizenID,
          })),
        };
      }

      const patientKey = patients[0].PatientKey;

      // Step 2: count records filtered by Location and doctor restriction, join DimTestRun
      // Note: Doctor authorization is checked at patient level (any location), but counting is done for specific location
      const baseSelect = includeList
        ? `
          SELECT 
            f.PatientKey,
            f.DateReceived,
            f.Location,
            f.ProviderKey,
            dt.TestRunKey,
            dt.EHR_url
          FROM default.FactGeneticTestResult f
          INNER JOIN default.DimProvider dp ON f.ProviderKey = dp.ProviderKey
          LEFT JOIN default.DimTestRun dt ON f.TestRunKey = dt.TestRunKey
          WHERE f.PatientKey = ${patientKey}
            AND f.Location = '${targetLocation}'
            AND dp.DoctorId = ${doctorId}
          ORDER BY f.DateReceived DESC
        `
        : `
          SELECT 
            COUNT() as Count
          FROM default.FactGeneticTestResult f
          INNER JOIN default.DimProvider dp ON f.ProviderKey = dp.ProviderKey
          WHERE f.PatientKey = ${patientKey}
            AND f.Location = '${targetLocation}'
            AND dp.DoctorId = ${doctorId}
        `;

      const recordsResult = await this.clickHouseService.query(baseSelect);
      const data = recordsResult.data || recordsResult;

      if (!includeList) {
        const countValue =
          Array.isArray(data) && data[0]?.Count !== undefined
            ? Number(data[0].Count)
            : 0;
        return {
          success: true,
          purpose,
          doctorId,
          patientIdentifier,
          patient: patients[0],
          recordType,
          location: targetLocation,
          total: countValue,
          message: `Tìm thấy ${countValue} lần cho loại '${recordType}'.`,
        };
      }

      // Include list: summarize EHR_url
      const list = (Array.isArray(data) ? data : []).map((r: any) => {
        let summary: any = null;
        if (r.EHR_url) {
          try {
            const parsed = JSON.parse(r.EHR_url);
            summary = {
              appointment: parsed?.appointment || null,
              patient: parsed?.patient || null,
              medical_record: parsed?.medical_record
                ? { ...parsed.medical_record, attachments: undefined }
                : null,
            };
          } catch (e) {
            summary = { raw: r.EHR_url };
          }
        }
        return {
          date: r.DateReceived,
          testRunKey: r.TestRunKey,
          location: r.Location,
          ehrSummary: this.cleanEhrDataForDoctor(summary),
        };
      });

      return {
        success: true,
        purpose,
        doctorId,
        patientIdentifier,
        patient: patients[0],
        recordType,
        location: targetLocation,
        total: list.length,
        list,
        message: `Đã lấy ${list.length} bản ghi cho loại '${recordType}'.`,
      };
    } catch (error) {
      this.logger.error(`Count patient records error: ${error.message}`);
      return {
        success: false,
        purpose,
        doctorId,
        patientIdentifier,
        recordType,
        error: error.message,
        message:
          'Có lỗi xảy ra khi đếm bản ghi bệnh nhân. Vui lòng thử lại hoặc cung cấp thêm thông tin.',
      };
    }
  }

  /**
   * Clean EHR data to remove S3 links, file paths, and internal URLs
   * Only return medical information relevant for doctors
   */
  private cleanEhrDataForDoctor(ehrData: any): any {
    if (!ehrData || typeof ehrData !== 'object') {
      return ehrData;
    }

    // Deep clone to avoid modifying original data
    const cleanData = JSON.parse(JSON.stringify(ehrData));

    // Remove file paths and S3 links from lab tests
    if (cleanData.medical_record?.lab_test) {
      cleanData.medical_record.lab_test = cleanData.medical_record.lab_test.map(
        (test: any) => {
          const cleanTest = { ...test };

          // Remove file attachments and URLs
          delete cleanTest.file_attachments;
          delete cleanTest.file_url;
          delete cleanTest.url;
          delete cleanTest.path;

          // Keep only medical information
          return {
            test_type: cleanTest.test_type,
            test_name: cleanTest.test_name,
            machine: cleanTest.machine,
            taken_by: cleanTest.taken_by,
            notes: cleanTest.notes,
            conclusion: cleanTest.conclusion,
            results: cleanTest.results || [],
          };
        },
      );
    }

    // Remove any other file paths or URLs
    const removeFilePaths = (obj: any) => {
      if (obj && typeof obj === 'object') {
        Object.keys(obj).forEach((key) => {
          if (
            typeof obj[key] === 'string' &&
            (obj[key].includes('/path/to/') ||
              obj[key].includes('s3://') ||
              obj[key].includes('http://') ||
              obj[key].includes('https://') ||
              obj[key].includes('.pdf') ||
              obj[key].includes('.dcm') ||
              obj[key].includes('.jpg') ||
              obj[key].includes('.png'))
          ) {
            delete obj[key];
          } else if (typeof obj[key] === 'object') {
            removeFilePaths(obj[key]);
          }
        });
      }
    };

    removeFilePaths(cleanData);

    return cleanData;
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

  private generateVariantSearchQueries(variants: string[]): string[] {
    const queries: string[] = [];
    const templates = [
      '"{v}" ClinVar clinical significance pathogenic likely pathogenic',
      '"{v}" disease association OMIM PubMed review',
      '"{v}" gnomAD frequency population database',
    ];
    for (const v of variants) {
      for (const t of templates) {
        queries.push(t.replace('{v}', v));
      }
    }
    return queries;
  }

  private parseTopVariantsFromPythonOutput(output: string): string[] {
    try {
      // Look for a line starting with TOP_VARIANTS_JSON:
      const markerRegex = /TOP_VARIANTS_JSON\s*:\s*(\[.*\])/s;
      const m = markerRegex.exec(output);
      if (m && m[1]) {
        const jsonText = m[1].trim();
        const arr = JSON.parse(jsonText);
        if (Array.isArray(arr)) {
          return arr.filter((x) => typeof x === 'string').slice(0, 3);
        }
      }
    } catch (_) {}
    return [];
  }

  private parseGeneSheetInfoFromPythonOutput(output: string): any | null {
    try {
      const markerRegex = /GENE_SHEET_INFO_JSON\s*:\s*(\{[\s\S]*\})/;
      const m = markerRegex.exec(output);
      if (m && m[1]) {
        return JSON.parse(m[1]);
      }
    } catch (_) {}
    return null;
  }
}
