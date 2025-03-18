// import { RFQModel } from '../models/rfq.model';
// import { RFQ, RFQDocument } from '../types/rfq';
// import mongoose from 'mongoose';
// import { AppError } from '../middleware/error';
// import { sendInvitationEmail } from './email.service';
// import { RFQAnalysis, createAnalysisPayload } from "../utils/rfq.utils";
// import fs from 'fs';

// export class RFQService {
//   private excelService: ExcelService;
  
//   constructor() {
//     this.excelService = new ExcelService();
//   }

//   async create(rfqData: any): Promise<RFQDocument> {
//     try {
//       // Ensure required fields are present
//       if (!rfqData.title) {
//         const error: any = new Error('RFQ title is required');
//         error.statusCode = 400;
//         throw error;
//       }
      
//       // Initialize empty arrays if they don't exist
//       if (!rfqData.suppliers) {
//         rfqData.suppliers = [];
//       } else {
//         // Ensure each supplier has an id and valid status
//         rfqData.suppliers = rfqData.suppliers.map((supplier: any, index: number) => {
//           const updatedSupplier = { ...supplier };
          
//           // Add ID if missing
//           if (!updatedSupplier.id) {
//             updatedSupplier.id = updatedSupplier._id || Date.now() + index;
//           }
          
//           // Set a valid status if 'pending' is not allowed
//           if (updatedSupplier.status === 'pending') {
//             updatedSupplier.status = 'invited'; // Use a valid status from your enum
//           }
          
//           return updatedSupplier;
//         });
//       }
      
//       // Ensure termsAndConditions exists with at least a timestamp
//       if (!rfqData.termsAndConditions) {
//         rfqData.termsAndConditions = {
//           timestamp: new Date().toISOString(),
//           fields: [],
//           subsections: []
//         };
//       } else if (!rfqData.termsAndConditions.timestamp) {
//         rfqData.termsAndConditions.timestamp = new Date().toISOString();
//       }
      
//       // Create and return the RFQ
//       const rfq = new RFQModel(rfqData);
//       return await rfq.save();
//     } catch (error: any) {
//       console.error('Error creating RFQ:', error);
      
//       // Add status code if not present
//       if (!error.statusCode) {
//         error.statusCode = 500;
//       }
//       throw error;
//     }
//   }

//   async findAll(query: any = {}): Promise<any[]> {
//     try {
//       return await RFQModel.find(query).sort({ createdAt: -1 });
//     } catch (error) {
//       throw new AppError(500, 'Failed to fetch RFQs');
//     }
//   }

//   async findById(id: string): Promise<any | null> {
//     try {
//       const rfq = await RFQModel.findById(id);
//       if (!rfq) {
//         return null;
//       }
//       return rfq;
//     } catch (error) {
//       console.error('Error finding RFQ by ID:', error);
//       return null;
//     }
//   }

//   async update(id: string, rfqData: Partial<RFQ>): Promise<any | null> {
//     try {
//       const rfq = await RFQModel.findByIdAndUpdate(
//         id,
//         rfqData,
//         { new: true }
//       );
      
//       if (!rfq) {
//         return null;
//       }
      
//       return rfq;
//     } catch (error) {
//       throw new AppError(500, 'Failed to update RFQ');
//     }
//   }

//   async delete(id: string): Promise<boolean> {
//     try {
//       const result = await RFQModel.findByIdAndDelete(id);
//       return !!result;
//     } catch (error) {
//       throw new AppError(500, 'Failed to delete RFQ');
//     }
//   }

//   /**
//    * Generate and send Excel file for an RFQ to a specific supplier
//    */
//   async generateAndSendExcel(rfqId: string, supplierEmail: string, supplierName: string): Promise<void> {
//     try {
//       // Find the RFQ
//       const rfq = await this.findById(rfqId);
//       if (!rfq) {
//         throw new Error(`RFQ with ID ${rfqId} not found`);
//       }
      
//       // Generate Excel file
//       let templateStructure = null;
//       if (rfq.template && rfq.template.processedStructure) {
//         templateStructure = rfq.template.processedStructure;
//       }
      
//       // Find the supplier in the RFQ to get the ID
//       const supplier = rfq.suppliers.find((s: any) => s.email === supplierEmail);
//       const supplierId = supplier ? supplier.id : null;
      
//       // Generate Excel file with supplier ID if available
//       const excelFilePath = await this.excelService.generateRFQExcel(
//         rfq, 
//         supplierId, 
//         templateStructure
//       );
      
//       // Send email with attachment
//       await sendInvitationEmail(supplierEmail, {
//         rfqId: rfq._id,
//         rfqTitle: rfq.title,
//         supplierName: supplierName,
//         excelFilePath: excelFilePath
//       });
      
//       // If we found a supplier, update their status
//       if (supplier) {
//         // Update the supplier status to 'invited'
//         const updatedSuppliers = rfq.suppliers.map((s: any) => {
//           if (s.id.toString() === supplier.id.toString()) {
//             return { ...s, status: 'invited' };
//           }
//           return s;
//         });
        
//         await this.update(rfqId, { suppliers: updatedSuppliers });
//       }
      
//       // Clean up the temporary file
//       fs.unlink(excelFilePath, (err) => {
//         if (err) {
//           console.error('Error deleting temporary Excel file:', err);
//         }
//       });
//     } catch (error) {
//       console.error('Error generating and sending Excel:', error);
//       throw error;
//     }
//   }

//   /**
//    * Generate Excel file for an RFQ
//    */
//   async generateRFQExcel(rfq: RFQDocument, templateStructure?: any): Promise<string> {
//     return this.excelService.generateRFQExcel(rfq, templateStructure);
//   }

//   /**
//    * Process supplier Excel file and extract data
//    */
//   async processSupplierExcel(rfqId: string, supplierId: string, fileBuffer: Buffer): Promise<any> {
//     try {
//       // Get the RFQ document
//       const rfq = await RFQModel.findById(rfqId);
//       if (!rfq) {
//         throw new Error(`RFQ with ID ${rfqId} not found`);
//       }
      
//       // Extract data from the Excel file buffer
//       const extractedData = await this.excelService.extractDataFromExcelBuffer(fileBuffer, rfq, supplierId);
      
//       return extractedData;
//     } catch (error) {
//       console.error('Error processing supplier Excel:', error);
//       throw error;
//     }
//   }

//   /**
//    * Store supplier response data
//    */
//   async storeSupplierResponse(rfqId: string, supplierId: string, responseData: any): Promise<void> {
//     try {
//       // Update the RFQ document with the supplier's response
//       await RFQModel.updateOne(
//         { 
//           _id: rfqId,
//           'suppliers.id': supplierId 
//         },
//         {
//           $set: {
//             'suppliers.$.response': responseData,
//             'suppliers.$.responseSubmittedAt': new Date(),
//             'suppliers.$.status': 'responded'
//           }
//         }
//       );
//     } catch (error) {
//       console.error('Error storing supplier response:', error);
//       throw error;
//     }
//   }

//   /**
//    * Get Excel file for a supplier for a specific RFQ
//    */
//   async getSupplierExcelFile(rfqId: string, supplierId: string): Promise<string> {
//     try {
//       // Get the RFQ document
//       const rfq = await RFQModel.findById(rfqId);
//       if (!rfq) {
//         throw new Error(`RFQ with ID ${rfqId} not found`);
//       }
      
//       // Check if the supplier exists in the RFQ
//       if (!rfq.suppliers || !Array.isArray(rfq.suppliers)) {
//         throw new Error(`No suppliers found for RFQ ${rfqId}`);
//       }
      
//       const supplier = rfq.suppliers.find(s => s.id.toString() === supplierId);
//       if (!supplier) {
//         throw new Error(`Supplier with ID ${supplierId} not found in RFQ ${rfqId}`);
//       }
      
//       // Get the Excel file from the Excel service
//       return this.excelService.getSupplierExcelFile(rfqId, supplierId);
//     } catch (error) {
//       console.error('Error getting supplier Excel file:', error);
//       throw error;
//     }
//   }

//   getAnalysis = async (id: string): Promise<RFQAnalysis> => {
//     try {
//       const rfq = await this.findById(id);
//       if (!rfq) {
//         throw new AppError(404, "RFQ not found");
//       }
//       return createAnalysisPayload(rfq);
//     } catch (error) {
//       throw new AppError(500, "Failed to fetch RFQ analysis");
//     }
//   };

// } 