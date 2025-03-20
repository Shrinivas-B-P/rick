import { SQRModel, SQRDocument } from '../models/sqr.model';
import { RFQService } from './rfq.service';
import { AppError } from '../utils/error';
import { ExcelService } from './excel.service';
import path from 'path';
import os from 'os';

export class SQRService {
  private rfqService: RFQService;
  private excelService: ExcelService;

  constructor() {
    this.rfqService = new RFQService();
    this.excelService = new ExcelService();
  }

  /**
   * Create a new SQR from an RFQ
   * @param rfqId The RFQ ID
   * @param supplierId The supplier ID
   * @param supplierName The supplier name
   * @param supplierEmail The supplier email
   * @returns The created SQR document
   */
  async createFromRFQ(rfqId: string, supplierId: string, supplierName: string, supplierEmail: string): Promise<SQRDocument> {
    try {
      // Find the RFQ
      const rfq = await this.rfqService.findById(rfqId);
      if (!rfq) {
        throw new AppError(404, `RFQ with ID ${rfqId} not found`);
      }

      // Check if an SQR already exists for this RFQ and supplier
      const existingSQR = await SQRModel.findOne({ rfqId, supplierId });
      if (existingSQR) {
        return existingSQR;
      }

      // Create a new SQR
      const sqr = await SQRModel.create({
        rfqId,
        supplierId,
        supplierName,
        supplierEmail,
        status: 'draft',
        lastUpdated: new Date(),
        sections: [],
        attachments: []
      });

      return sqr;
    } catch (error) {
      console.error('Error creating SQR from RFQ:', error);
      throw error;
    }
  }

  /**
   * Find SQR by ID
   * @param id The SQR ID
   * @returns The SQR document or null if not found
   */
  async findById(id: string): Promise<SQRDocument | null> {
    try {
      return await SQRModel.findById(id);
    } catch (error) {
      console.error('Error finding SQR by ID:', error);
      throw error;
    }
  }

  /**
   * Find SQRs by RFQ ID
   * @param rfqId The RFQ ID
   * @returns Array of SQR documents
   */
  async findByRFQId(rfqId: string): Promise<SQRDocument[]> {
    try {
      return await SQRModel.find({ rfqId });
    } catch (error) {
      console.error('Error finding SQRs by RFQ ID:', error);
      throw error;
    }
  }

  /**
   * Update SQR
   * @param id The SQR ID
   * @param updateData The data to update
   * @returns The updated SQR document or null if not found
   */
  async update(id: string, updateData: any): Promise<SQRDocument | null> {
    try {
      // Find the SQR
      const sqr = await SQRModel.findById(id);
      if (!sqr) {
        return null;
      }

      // Update the SQR
      Object.assign(sqr, updateData);
      sqr.lastUpdated = new Date();

      // Save the updated SQR
      await sqr.save();

      return sqr;
    } catch (error) {
      console.error('Error updating SQR:', error);
      throw error;
    }
  }

  /**
   * Delete SQR
   * @param id The SQR ID
   * @returns True if deleted, false if not found
   */
  async delete(id: string): Promise<boolean> {
    try {
      const result = await SQRModel.findByIdAndDelete(id);
      return !!result;
    } catch (error) {
      console.error('Error deleting SQR:', error);
      throw error;
    }
  }

  /**
   * Generate Excel file for SQR
   * @param sqr The SQR document
   * @returns Path to the generated Excel file
   */
  async generateSQRExcel(sqr: SQRDocument): Promise<string> {
    try {
      // Create a temporary file path
      const tempFilePath = path.join(os.tmpdir(), `sqr-${sqr._id}-${Date.now()}.xlsx`);
      
      // Generate Excel file (simplified implementation)
      // In a real implementation, you would create a proper Excel file with the SQR data
      const workbook = new ExcelJS.Workbook();
      workbook.creator = 'SQR System';
      workbook.lastModifiedBy = 'SQR System';
      workbook.created = new Date();
      workbook.modified = new Date();
      
      // Add a worksheet
      const worksheet = workbook.addWorksheet('SQR Details');
      
      // Add some basic information
      worksheet.addRow(['Supplier Quote Request']);
      worksheet.addRow(['RFQ ID', sqr.rfqId.toString()]);
      worksheet.addRow(['Supplier', sqr.supplierName]);
      worksheet.addRow(['Status', sqr.status]);
      
      // Write to file
      await workbook.xlsx.writeFile(tempFilePath);
      
      return tempFilePath;
    } catch (error) {
      console.error('Error generating SQR Excel:', error);
      throw error;
    }
  }
}

// Add ExcelJS import at the top
import ExcelJS from 'exceljs'; 