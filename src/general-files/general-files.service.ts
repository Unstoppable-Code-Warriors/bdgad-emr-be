import { Injectable, NotFoundException } from '@nestjs/common';
import { ClickHouseService } from '../clickhouse/clickhouse.service';

// Types for queue data
interface QueueGeneralFile {
  id: number;
  fileName: string;
  fileType: string;
  fileSize: number;
  filePath: string;
  description: string;
  categoryId: number;
  uploadedBy: number;
  uploadedAt: string;
  sendEmrAt: string;
}

interface QueueCategory {
  id: number;
  name: string;
  description: string;
  generalFiles: QueueGeneralFile[];
}

@Injectable()
export class GeneralFilesService {
  constructor(private readonly clickHouseService: ClickHouseService) {}

  /**
   * Process folder-batch data from queue
   */
  async processFolderBatch(data: QueueCategory[]) {
    console.log('Processing folder-batch data...');

    const result = {
      categories: { inserted: 0, updated: 0 },
      files: { inserted: 0, updated: 0 },
    };

    for (const categoryData of data) {
      // Process category
      const categoryResult = await this.upsertCategory(categoryData);
      if (categoryResult.inserted) result.categories.inserted++;
      if (categoryResult.updated) result.categories.updated++;

      // Process files in category
      for (const fileData of categoryData.generalFiles) {
        const fileResult = await this.upsertFile(fileData);
        if (fileResult.inserted) result.files.inserted++;
        if (fileResult.updated) result.files.updated++;
      }
    }

    console.log('Folder-batch processing completed:', result);
    return result;
  }

  /**
   * Upsert category (insert if not exists, update if exists)
   */
  async upsertCategory(categoryData: QueueCategory) {
    try {
      // Check if category exists
      const existingCategory = await this.clickHouseService.query(
        'SELECT id FROM categories WHERE id = {categoryId:UInt32} LIMIT 1',
        { categoryId: categoryData.id },
      );

      const exists = existingCategory?.data?.length > 0;

      if (!exists) {
        // Only insert if it doesn't exist
        await this.clickHouseService.insert('categories', [
          {
            id: categoryData.id,
            name: categoryData.name,
            description: categoryData.description,
          },
        ]);

        console.log(`Inserted new category ID: ${categoryData.id}`);
        return { updated: false, inserted: true };
      } else {
        console.log(
          `Category ID ${categoryData.id} already exists, skipping insert`,
        );
        return { updated: true, inserted: false };
      }
    } catch (error) {
      console.error(
        `Error processing category ID ${categoryData.id}:`,
        error.message,
      );
      return { updated: false, inserted: false };
    }
  }

  /**
   * Upsert file (insert if not exists, update if exists)
   */
  async upsertFile(fileData: QueueGeneralFile) {
    try {
      // Check if file exists
      const existingFile = await this.clickHouseService.query(
        'SELECT id FROM general_files WHERE id = {fileId:UInt32} LIMIT 1',
        { fileId: fileData.id },
      );

      const exists = existingFile?.data?.length > 0;

      if (!exists) {
        // Transform dates from ISO to ClickHouse format
        const uploadedAt = new Date(fileData.uploadedAt)
          .toISOString()
          .slice(0, 19)
          .replace('T', ' ');
        const sendEmrAt = new Date(fileData.sendEmrAt)
          .toISOString()
          .slice(0, 19)
          .replace('T', ' ');

        // Only insert if it doesn't exist
        await this.clickHouseService.insert('general_files', [
          {
            id: fileData.id,
            file_name: fileData.fileName,
            file_type: fileData.fileType,
            file_size: fileData.fileSize,
            file_path: fileData.filePath,
            description: fileData.description,
            category_id: fileData.categoryId,
            uploaded_by: fileData.uploadedBy,
            uploaded_at: uploadedAt,
            send_emr_at: sendEmrAt,
          },
        ]);

        console.log(`Inserted new file ID: ${fileData.id}`);
        return { updated: false, inserted: true };
      } else {
        console.log(`File ID ${fileData.id} already exists, skipping insert`);
        return { updated: true, inserted: false };
      }
    } catch (error) {
      console.error(`Error processing file ID ${fileData.id}:`, error.message);
      return { updated: false, inserted: false };
    }
  }

  async getAllFiles() {
    const result = await this.clickHouseService.query(`
      SELECT 
        c.id as category_id,
        c.name as category_name,
        c.description as category_description,
        gf.id,
        gf.file_name,
        gf.file_type,
        gf.file_size,
        gf.uploaded_at,
        gf.send_emr_at
      FROM general_files gf 
      JOIN categories c ON gf.category_id = c.id 
      ORDER BY c.id, gf.uploaded_at DESC
    `);

    return {
      total: result?.data?.length || 0,
      files: result?.data || [],
    };
  }

  async getFilesByCategories() {
    const result = await this.clickHouseService.query(`
      SELECT 
        c.id as category_id,
        c.name as category_name,
        c.description as category_description,
        gf.id,
        gf.file_name,
        gf.file_type,
        gf.file_size,
        gf.file_path,
        gf.uploaded_at,
        gf.send_emr_at
      FROM general_files gf 
      JOIN categories c ON gf.category_id = c.id 
      ORDER BY c.id, gf.uploaded_at DESC
    `);

    const files = result?.data || [];

    // Group files by category
    const groupedData = files.reduce((acc: any, file: any) => {
      const categoryId = file.category_id;

      if (!acc[categoryId]) {
        acc[categoryId] = {
          category_id: file.category_id,
          category_name: file.category_name,
          category_description: file.category_description,
          file_count: 0,
          files: [],
        };
      }

      acc[categoryId].files.push({
        id: file.id,
        file_name: file.file_name,
        file_type: file.file_type,
        file_size: file.file_size,
        file_path: file.file_path,
        uploaded_at: file.uploaded_at,
        send_emr_at: file.send_emr_at,
      });

      acc[categoryId].file_count++;

      return acc;
    }, {} as any);

    const categories = Object.values(groupedData as any);

    return {
      total_files: files.length,
      total_categories: categories.length,
      categories: categories,
    };
  }

  async getFileDetail(fileId: number) {
    const result = await this.clickHouseService.query(
      `
      SELECT 
        c.id as category_id,
        c.name as category_name,
        c.description as category_description,
        gf.id,
        gf.file_name,
        gf.file_type,
        gf.file_size,
        gf.file_path,
        gf.description as file_description,
        gf.uploaded_by,
        gf.uploaded_at,
        gf.send_emr_at,
        gf.created_at,
        gf.updated_at
      FROM general_files gf 
      JOIN categories c ON gf.category_id = c.id 
      WHERE gf.id = {fileId:UInt32}
    `,
      { fileId },
    );

    const file = result?.data?.[0];
    if (!file) {
      throw new NotFoundException(`File with ID ${fileId} not found`);
    }

    return file;
  }
}
