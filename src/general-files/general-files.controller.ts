import { Controller, Get, Param, ParseIntPipe } from '@nestjs/common';
import { EventPattern } from '@nestjs/microservices';
import { GeneralFilesService } from './general-files.service';

/**
 * General Files Controller
 *
 * Provides 3 APIs:
 * 1. GET /general-files - List all files with category info
 * 2. GET /general-files/by-categories - List all files grouped by category
 * 3. GET /general-files/:id - Get detailed info of a specific file
 *
 * And message handler:
 * - folder-batch: Process batch data from general_file queue
 */
@Controller('general-files')
export class GeneralFilesController {
  constructor(private readonly generalFilesService: GeneralFilesService) {}

  /**
   * Message handler for folder-batch pattern from general_file queue
   *
   * @param data - Array of categories with general files
   */
  @EventPattern('folder-batch')
  async handleFolderBatch(data: any[]) {
    try {
      console.log(
        'Received folder-batch message:',
        JSON.stringify(data, null, 2),
      );

      const result = await this.generalFilesService.processFolderBatch(data);

      console.log('Processed folder-batch successfully:', result);
      return { success: true, processed: result };
    } catch (error) {
      console.error('Error processing folder-batch:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * List all general files with category information
   *
   * @returns {Object} { total: number, files: Array }
   * @example
   * {
   *   "total": 5,
   *   "files": [
   *     {
   *       "category_id": 10,
   *       "category_name": "Hàng danh mục thuốc",
   *       "id": 13,
   *       "file_name": "Hàng danh mục thuốc",
   *       "file_type": "docx",
   *       "file_size": 8010,
   *       "uploaded_at": "2025-08-08T16:33:01",
   *       "send_emr_at": "2025-08-08T16:33:35"
   *     }
   *   ]
   * }
   */
  @Get()
  async getAllFiles() {
    return this.generalFilesService.getAllFiles();
  }

  /**
   * List all files grouped by categories
   *
   * @returns {Object} { total_files: number, total_categories: number, categories: Array }
   * @example
   * {
   *   "total_files": 5,
   *   "total_categories": 2,
   *   "categories": [
   *     {
   *       "category_id": 10,
   *       "category_name": "Hàng danh mục thuốc",
   *       "category_description": "Danh mục thuốc là bảng...",
   *       "file_count": 2,
   *       "files": [
   *         {
   *           "id": 13,
   *           "file_name": "Hàng danh mục thuốc",
   *           "file_type": "docx",
   *           "file_size": 8010,
   *           "uploaded_at": "2025-08-08T16:33:01"
   *         }
   *       ]
   *     }
   *   ]
   * }
   */
  @Get('by-categories')
  async getFilesByCategories() {
    return this.generalFilesService.getFilesByCategories();
  }

  /**
   * Get detailed information of a specific file
   *
   * @param id - File ID
   * @returns {Object} Complete file information with category details
   * @throws {NotFoundException} When file with given ID is not found
   * @example
   * {
   *   "category_id": 10,
   *   "category_name": "Hàng danh mục thuốc",
   *   "category_description": "Danh mục thuốc là bảng dữ liệu...",
   *   "id": 13,
   *   "file_name": "Hàng danh mục thuốc",
   *   "file_type": "docx",
   *   "file_size": 8010,
   *   "file_path": "https://...",
   *   "file_description": "General File",
   *   "uploaded_by": 1,
   *   "uploaded_at": "2025-08-08T16:33:01",
   *   "send_emr_at": "2025-08-08T16:33:35",
   *   "created_at": "2025-08-08T21:27:34",
   *   "updated_at": "2025-08-08T21:27:34"
   * }
   */
  @Get(':id')
  async getFileDetail(@Param('id', ParseIntPipe) id: number) {
    return this.generalFilesService.getFileDetail(id);
  }
}
