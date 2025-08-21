// ai-chat.service.ts - Enhanced for genomics workflow
import { Injectable, Logger } from '@nestjs/common';
import { createSystemMessages } from './constants/prompt';
import { ChatReqDto } from './dto/chat-req.dto';
import { convertToModelMessages, stepCountIs, streamText, tool } from 'ai';
import { openai } from '@ai-sdk/openai';
import { UserInfo } from 'src/auth';
import z from 'zod';
import { DaytonaService } from 'src/daytona/daytona.service';

@Injectable()
export class AiChatService {
  private readonly logger = new Logger(AiChatService.name);

  constructor(private readonly daytonaService: DaytonaService) {}

  public async handleChat(request: ChatReqDto, user: UserInfo) {
    const { messages: uiMessages, excelFilePath } = request;
    const messages = convertToModelMessages(uiMessages);

    const result = streamText({
      model: openai.responses('gpt-4.1-mini'),
      messages: [...createSystemMessages(excelFilePath), ...messages],
      temperature: 0.3, // Lower temperature for more consistent medical analysis
      maxOutputTokens: 2000, // Increased for comprehensive analysis
      stopWhen: stepCountIs(20), // Allow more steps for thorough analysis
      tools: {
        // Web search tool for medical research
        web_search_preview: openai.tools.webSearchPreview({
          toModelOutput: (output) => {
            this.logger.log('Web search performed for genomics analysis');
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

        // STEP 2: Create comprehensive analysis strategy
        createAnalysisStrategy: tool({
          description: `BƯỚC 2: Tạo chiến lược phân tích TOÀN DIỆN cho tất cả sheets trong file.
          
          LLM tự generate Python code để PHÂN TÍCH SÂU:
          - Re-download Excel file (vì mỗi Python session riêng biệt)
          - QUÉT TOÀN BỘ sheets: Info, Variant, Gene, Sample, Mapping, Error (nếu có)
          - Chi tiết phân tích TỪNG SHEET:
            * Info sheet: metadata, analysis parameters, version info
            * Variant sheet: variant counts, column mapping, data quality
            * Gene sheet: gene annotations, functional categories
            * Sample sheet: sample info, demographics, sequencing stats
            * Mapping sheet: mapping statistics, coverage info
          - Xác định data relationships giữa các sheets
          - Phát hiện missing data, quality issues, inconsistencies
          - Lập COMPREHENSIVE analysis strategy cho tất cả data layers
          - Prioritize analyses: variants → genes → samples → clinical significance
          - Output: detailed strategy với specific analysis steps cho mỗi sheet
          
          QUAN TRỌNG: Không chỉ focus vào Variant sheet mà phải hiểu TOÀN BỘ dataset`,
          inputSchema: z.object({
            pythonCode: z
              .string()
              .describe(
                'Python code do LLM generate để phân tích TOÀN BỘ sheets và tạo comprehensive strategy',
              ),
            retryCount: z
              .number()
              .optional()
              .default(0)
              .describe('Số lần retry nếu có lỗi'),
          }),
          execute: async ({ pythonCode, retryCount = 0 }) => {
            this.logger.log(
              `Creating comprehensive analysis strategy with LLM code, retry: ${retryCount}`,
            );
            return await this.executeStrategyStep(pythonCode, retryCount);
          },
        }),

        // STEP 3: Execute genomics analysis
        executeGenomicsAnalysis: tool({
          description: `BƯỚC 3: Thực hiện phân tích dữ liệu gen theo strategy từ bước 2.
          
          LLM tự generate Python code để:
          - Re-download Excel file: pd.read_excel(excel_file_path, sheet_name=None)
          - Focus vào Variant sheet (có 53001 rows, 102 columns)
          - QUAN TRỌNG: Columns có headers ở row đầu tiên, cần skip header rows nếu cần
          - Dynamic column detection: tìm columns có 'Gene', 'ClinVar', 'COSMIC', etc.
          - Pathogenic variants analysis: filter ClinVar significance
          - Gene analysis: group by genes, count variants per gene
          - Extract findings: genes list, diseases list, pathogenic count
          - AVOID pandas warnings: use .loc[] and .copy() appropriately
          
          Expected output: key_genes list, pathogenic_diseases list, analysis summary`,
          inputSchema: z.object({
            pythonCode: z
              .string()
              .describe(
                'Python code do LLM generate để phân tích genomics - phải handle openCRAVAT format correctly',
              ),
            retryCount: z
              .number()
              .optional()
              .default(0)
              .describe('Số lần retry nếu có lỗi'),
          }),
          execute: async ({ pythonCode, retryCount = 0 }) => {
            this.logger.log(
              `Executing genomics analysis with LLM code, retry: ${retryCount}`,
            );
            return await this.executeAnalysisStep(pythonCode, retryCount);
          },
        }),

        // STEP 4: Prepare for web search
        prepareWebSearch: tool({
          description: `BƯỚC 4: Chuẩn bị thông tin cho web search về disease associations.
          
          LLM tự generate Python code để:
          - Sử dụng analysis results từ bước 3
          - Extract key genes và pathogenic diseases
          - Generate search queries suggestions
          - Provide structure cho final report
          
          Input: Analysis results từ bước 3`,
          inputSchema: z.object({
            pythonCode: z
              .string()
              .describe('Python code do LLM generate để chuẩn bị web search'),
            retryCount: z
              .number()
              .optional()
              .default(0)
              .describe('Số lần retry nếu có lỗi'),
          }),
          execute: async ({ pythonCode, retryCount = 0 }) => {
            this.logger.log(
              `Preparing web search with LLM code, retry: ${retryCount}`,
            );
            return await this.executeSearchStep(pythonCode, retryCount);
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
          nextStep: 'strategy',
          message:
            '✅ Đã khám phá xong cấu trúc file. Tiếp theo: lập chiến lược phân tích.',
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

  private async executeStrategyStep(
    pythonCode?: string,
    retryCount: number = 0,
  ) {
    try {
      // If no pythonCode provided, return error (LLM should generate it)
      if (!pythonCode) {
        throw new Error(
          'No Python code provided for strategy step. LLM should generate the analysis strategy code.',
        );
      }

      this.logger.log('Executing LLM-generated strategy code');
      const result = await this.daytonaService.executePythonCode(pythonCode);

      if (result.exitCode === 0) {
        return {
          success: true,
          stepName: 'strategy',
          result: result.result,
          nextStep: 'analyze',
          message:
            '✅ Đã phân tích toàn diện tất cả sheets và lập comprehensive strategy. Tiếp theo: thực hiện multi-layer analysis.',
        };
      } else {
        throw new Error(`Strategy planning failed: ${result.result}`);
      }
    } catch (error) {
      if (retryCount < 3) {
        return {
          success: false,
          stepName: 'strategy',
          error: error.message,
          nextStep: 'strategy',
          retryCount: retryCount + 1,
          message: `❌ Lỗi phân tích comprehensive strategy (lần ${retryCount + 1}). LLM cần generate code mới để quét toàn bộ sheets...`,
        };
      }
      return {
        success: false,
        stepName: 'strategy',
        error: error.message,
        nextStep: null,
        message: '❌ Không thể tạo comprehensive strategy sau 3 lần thử.',
      };
    }
  }

  private async executeAnalysisStep(
    pythonCode?: string,
    retryCount: number = 0,
  ) {
    try {
      // If no pythonCode provided, return error (LLM should generate it)
      if (!pythonCode) {
        throw new Error(
          'No Python code provided for analysis step. LLM should generate the genomics analysis code.',
        );
      }

      this.logger.log('Executing LLM-generated analysis code');
      const result = await this.daytonaService.executePythonCode(pythonCode);

      if (result.exitCode === 0) {
        return {
          success: true,
          stepName: 'analyze',
          result: result.result,
          nextStep: 'search',
          message:
            '✅ Đã phân tích xong dữ liệu gen. Tiếp theo: tìm kiếm thông tin bệnh lý.',
        };
      } else {
        throw new Error(`Analysis failed: ${result.result}`);
      }
    } catch (error) {
      if (retryCount < 3) {
        return {
          success: false,
          stepName: 'analyze',
          error: error.message,
          nextStep: 'analyze',
          retryCount: retryCount + 1,
          message: `❌ Lỗi phân tích dữ liệu (lần ${retryCount + 1}). LLM cần generate code mới và thử lại...`,
        };
      }
      return {
        success: false,
        stepName: 'analyze',
        error: error.message,
        nextStep: null,
        message: '❌ Không thể phân tích dữ liệu sau 3 lần thử.',
      };
    }
  }

  private async executeSearchStep(pythonCode?: string, retryCount: number = 0) {
    try {
      // If no pythonCode provided, return simple search ready status
      if (!pythonCode) {
        return {
          success: true,
          stepName: 'search',
          nextStep: null,
          message:
            '✅ Đã hoàn thành phân tích. Bây giờ cần search thông tin bệnh lý trên internet.',
          searchReady: true,
          instruction:
            'Hãy sử dụng tool web_search_preview để tìm kiếm thông tin về các gen và bệnh lý đã được phát hiện.',
        };
      }

      this.logger.log('Executing LLM-generated search preparation code');
      const result = await this.daytonaService.executePythonCode(pythonCode);

      if (result.exitCode === 0) {
        return {
          success: true,
          stepName: 'search',
          result: result.result,
          nextStep: null,
          message:
            '✅ Đã chuẩn bị xong thông tin search. Bây giờ thực hiện web search.',
          searchReady: true,
          instruction:
            'Sử dụng web_search_preview để tìm kiếm disease associations.',
        };
      } else {
        throw new Error(`Search preparation failed: ${result.result}`);
      }
    } catch (error) {
      if (retryCount < 3) {
        return {
          success: false,
          stepName: 'search',
          error: error.message,
          nextStep: 'search',
          retryCount: retryCount + 1,
          message: `❌ Lỗi chuẩn bị search (lần ${retryCount + 1}). LLM cần generate code mới và thử lại...`,
        };
      }
      return {
        success: false,
        stepName: 'search',
        error: error.message,
        nextStep: null,
        message: '❌ Không thể chuẩn bị search sau 3 lần thử.',
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
