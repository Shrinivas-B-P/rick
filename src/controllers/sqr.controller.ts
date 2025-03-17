import { Request, Response } from 'express';
import { SQRService } from '../services/sqr.service';
import { ExcelImportService } from '../services/excel-import.service';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import os from 'os';

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, os.tmpdir());
  },
  filename: (req, file, cb) => {
    cb(null, `sqr-upload-${Date.now()}${path.extname(file.originalname)}`);
  }
});

const upload = multer({ 
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    // Accept only Excel files
    const filetypes = /xlsx|xls/;
    const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = filetypes.test(file.mimetype);
    
    if (extname && mimetype) {
      return cb(null, true);
    } else {
      cb(new Error('Only Excel files are allowed'));
    }
  }
}).single('file');

export class SQRController {
  private sqrService: SQRService;
  private excelImportService: ExcelImportService;

  constructor() {
    this.sqrService = new SQRService();
    this.excelImportService = new ExcelImportService();
    
    // Bind methods
    this.createFromRFQ = this.createFromRFQ.bind(this);
    this.getById = this.getById.bind(this);
    this.getByRFQId = this.getByRFQId.bind(this);
    this.update = this.update.bind(this);
    this.delete = this.delete.bind(this);
    this.downloadExcel = this.downloadExcel.bind(this);
    this.uploadExcel = this.uploadExcel.bind(this);
    this.submitSQR = this.submitSQR.bind(this);
  }

  /**
   * Create a new SQR from an RFQ
   */
  async createFromRFQ(req: Request, res: Response): Promise<void> {
    try {
      const { rfqId, supplierId, supplierName, supplierEmail } = req.body;
      
      if (!rfqId || !supplierId || !supplierName || !supplierEmail) {
        res.status(400).json({
          success: false,
          message: 'rfqId, supplierId, supplierName, and supplierEmail are required'
        });
        return;
      }
      
      const sqr = await this.sqrService.createFromRFQ(rfqId, supplierId, supplierName, supplierEmail);
      
      res.status(201).json({
        success: true,
        message: 'SQR created successfully',
        data: sqr
      });
    } catch (error: any) {
      console.error('Error creating SQR:', error);
      res.status(error.statusCode || 500).json({
        success: false,
        message: error.message || 'Failed to create SQR'
      });
    }
  }

  /**
   * Get SQR by ID
   */
  async getById(req: Request, res: Response): Promise<void> {
    try {
      const sqrId = req.params.id;
      const sqr = await this.sqrService.findById(sqrId);
      
      if (!sqr) {
        res.status(404).json({
          success: false,
          message: `SQR with ID ${sqrId} not found`
        });
        return;
      }
      
      res.status(200).json({
        success: true,
        data: sqr
      });
    } catch (error: any) {
      console.error('Error getting SQR:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to get SQR'
      });
    }
  }

  /**
   * Get SQRs by RFQ ID
   */
  async getByRFQId(req: Request, res: Response): Promise<void> {
    try {
      const rfqId = req.params.rfqId;
      const sqrs = await this.sqrService.findByRFQId(rfqId);
      
      res.status(200).json({
        success: true,
        data: sqrs
      });
    } catch (error: any) {
      console.error('Error getting SQRs by RFQ ID:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to get SQRs'
      });
    }
  }

  /**
   * Update SQR
   */
  async update(req: Request, res: Response): Promise<void> {
    try {
      const sqrId = req.params.id;
      const sqr = await this.sqrService.update(sqrId, req.body);
      
      if (!sqr) {
        res.status(404).json({
          success: false,
          message: `SQR with ID ${sqrId} not found`
        });
        return;
      }
      
      res.status(200).json({
        success: true,
        message: 'SQR updated successfully',
        data: sqr
      });
    } catch (error: any) {
      console.error('Error updating SQR:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to update SQR'
      });
    }
  }

  /**
   * Delete SQR
   */
  async delete(req: Request, res: Response): Promise<void> {
    try {
      const sqrId = req.params.id;
      const result = await this.sqrService.delete(sqrId);
      
      if (!result) {
        res.status(404).json({
          success: false,
          message: `SQR with ID ${sqrId} not found`
        });
        return;
      }
      
      res.status(200).json({
        success: true,
        message: 'SQR deleted successfully'
      });
    } catch (error: any) {
      console.error('Error deleting SQR:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to delete SQR'
      });
    }
  }

  /**
   * Download SQR Excel file
   */
  async downloadExcel(req: Request, res: Response): Promise<void> {
    try {
      const sqrId = req.params.id;
      const sqr = await this.sqrService.findById(sqrId);
      
      if (!sqr) {
        res.status(404).json({
          success: false,
          message: `SQR with ID ${sqrId} not found`
        });
        return;
      }
      
      // Generate Excel file
      const excelFilePath = await this.sqrService.generateSQRExcel(sqr);
      
      // Set headers for file download
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename=SQR-${sqr.supplierName.replace(/[^a-zA-Z0-9]/g, '-')}.xlsx`);
      
      // Send the file
      res.sendFile(excelFilePath, (err) => {
        if (err) {
          console.error('Error sending Excel file:', err);
          res.status(500).end();
        }
        
        // Clean up the temporary file after sending
        fs.unlink(excelFilePath, (unlinkErr) => {
          if (unlinkErr) {
            console.error('Error deleting temporary Excel file:', unlinkErr);
          }
        });
      });
    } catch (error: any) {
      console.error('Error downloading SQR Excel:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to download SQR Excel'
      });
    }
  }

  /**
   * Upload and process SQR Excel file
   */
  async uploadExcel(req: Request, res: Response): Promise<void> {
    upload(req, res, async (err) => {
      if (err) {
        console.error('Error uploading file:', err);
        res.status(400).json({
          success: false,
          message: err.message || 'Error uploading file'
        });
        return;
      }
      
      try {
        if (!req.file) {
          res.status(400).json({
            success: false,
            message: 'No file uploaded'
          });
          return;
        }
        
        const sqrId = req.params.id;
        const filePath = req.file.path;
        
        // Process the Excel file
        const sqr = await this.excelImportService.importSQRFromExcel(filePath, sqrId);
        
        res.status(200).json({
          success: true,
          message: 'SQR Excel file processed successfully',
          data: sqr
        });
      } catch (error: any) {
        console.error('Error processing SQR Excel:', error);
        res.status(error.statusCode || 500).json({
          success: false,
          message: error.message || 'Failed to process SQR Excel'
        });
      }
    });
  }

  /**
   * Submit SQR
   */
  async submitSQR(req: Request, res: Response): Promise<void> {
    try {
      const sqrId = req.params.id;
      const sqr = await this.excelImportService.submitSQR(sqrId);
      
      res.status(200).json({
        success: true,
        message: 'SQR submitted successfully',
        data: sqr
      });
    } catch (error: any) {
      console.error('Error submitting SQR:', error);
      res.status(error.statusCode || 500).json({
        success: false,
        message: error.message || 'Failed to submit SQR'
      });
    }
  }
} 