// import { Request, Response } from 'express';
// import { RFQModel } from '../models/rfq.model';
// import { RFQ, RFQDocument, Supplier } from '../types/rfq';
// import { sendInvitationEmail } from '../services/email.service';
// import mongoose from 'mongoose';
// import axios from 'axios';
// import FormData from 'form-data';
// import { RFQService } from '../services/rfq.service';
// import fs from 'fs';
// import { ExcelService } from '../services/excel.service';

// export class RFQController {
//   private rfqService: RFQService;
//   private excelService: ExcelService;

//   constructor() {
//     this.rfqService = new RFQService();
//     this.excelService = new ExcelService();
    
//     // Bind methods to preserve 'this' context
//     this.getAll = this.getAll.bind(this);
//     this.getById = this.getById.bind(this);
//     this.update = this.update.bind(this);
//     this.delete = this.delete.bind(this);
//     this.getRFQSuppliers = this.getRFQSuppliers.bind(this);
//     this.addSupplierToRFQ = this.addSupplierToRFQ.bind(this);
//     this.updateSupplierStatus = this.updateSupplierStatus.bind(this);
//     this.removeSupplierFromRFQ = this.removeSupplierFromRFQ.bind(this);
//     this.sendRFQToSuppliers = this.sendRFQToSuppliers.bind(this);
//     this.refreshRFQWithGemini = this.refreshRFQWithGemini.bind(this);
//     this.chatWithGemini = this.chatWithGemini.bind(this);
//     this.executeRFXCommands = this.executeRFXCommands.bind(this);
//     this.processDocumentWithGemini = this.processDocumentWithGemini.bind(this);
//     this.generateEmailWithGemini = this.generateEmailWithGemini.bind(this);
//     this.generateAndSendRFQExcel = this.generateAndSendRFQExcel.bind(this);
//     this.generateRFQExcel = this.generateRFQExcel.bind(this);
//     this.sendExcelToSuppliers = this.sendExcelToSuppliers.bind(this);
//     this.sendExcelForRFQ = this.sendExcelForRFQ.bind(this);
//     this.downloadSupplierExcel = this.downloadSupplierExcel.bind(this);
//     this.processSupplierExcel = this.processSupplierExcel.bind(this);
//   }

//   create = async (req: Request, res: Response): Promise<void> => {
//     try {
//       console.log('Creating new RFQ with data:', JSON.stringify(req.body, null, 2));
      
//       // Create the RFQ
//       const rfq = await this.rfqService.create(req.body);
      
//       // Check if there are suppliers to send the RFQ to
//       if (rfq.suppliers && rfq.suppliers.length > 0) {
//         // Send Excel files to all suppliers asynchronously
//         // We don't await this to avoid delaying the response
//         this.sendExcelToSuppliers(rfq).catch(error => {
//           console.error('Error sending Excel to suppliers:', error);
//         });
//       }
      
//       res.status(201).json({
//         success: true,
//         message: 'RFQ created successfully',
//         data: rfq
//       });
//     } catch (error: any) {
//       console.error('Error creating RFQ:', error);
      
//       // Check if this is a validation error from Mongoose
//       if (error.name === 'ValidationError') {
//         res.status(400).json({
//           success: false,
//           message: 'Validation error',
//           errors: Object.values(error.errors).map((err: any) => ({
//             message: err.message,
//             path: err.path
//           }))
//         });
//         return;
//       }
      
//       res.status(500).json({
//         success: false,
//         message: 'Failed to create RFQ',
//         error: error.message || 'Unknown error'
//       });
//     }
//   };

//   public async sendExcelForRFQ(req: Request, res: Response): Promise<void> {
//     console.log('req.body', req.body);
//     this.sendExcelToSuppliers(req.body).catch(error => {
//       console.error('Error sending Excel to suppliers:', error);
//     });
//     res.status(201).json({
//       success: true,
//       message: 'Mails sent successfully',
//       data: req.body
//     });
//   }

//   /**
//    * Helper method to send Excel files to all suppliers in an RFQ
//    */
//   private async sendExcelToSuppliers(rfq: RFQDocument): Promise<void> {
//     try {
//       if (!rfq.suppliers || rfq.suppliers.length === 0) {
//         console.log('No suppliers to send Excel to');
//         throw('No suppliers to send Excel to');
//       }
      
//       console.log(`Sending Excel to ${rfq.suppliers.length} suppliers`);
      
//       // Process each supplier
//       for (const supplier of rfq.suppliers) {
//         if (!supplier.email) {
//           console.warn(`Supplier ${supplier.id} has no email address, skipping`);
//           continue;
//         }
        
//         try {
//           // Get supplier name or use a default
//           const supplierName = supplier.name || 'Valued Supplier';
          
//           // Generate and send Excel
//           await this.rfqService.generateAndSendExcel(
//             rfq._id.toString(),
//             supplier.email,
//             supplierName
//           );
          
//           console.log(`Excel sent successfully to ${supplier.email}`);
//         } catch (error) {
//           console.error(`Failed to send Excel to supplier ${supplier.id} (${supplier.email}):`, error);
//           // Continue with other suppliers even if one fails
//         }
//       }
      
//       console.log('Finished sending Excel to all suppliers');
//     } catch (error) {
//       console.error('Error in sendExcelToSuppliers:', error);
//       throw error;
//     }
//   }

//   async getAll(req: Request, res: Response) {
//     try {
//       const rfqs = await this.rfqService.findAll();
//       res.json(rfqs);
//     } catch (error) {
//       res.status(500).json({ error: 'Failed to fetch RFQs' });
//     }
//   }

//   async getById(req: Request, res: Response) {
//     try {
//       const rfq = await RFQModel.findById(req.params.id);
//       if (!rfq) {
//         return res.status(404).json({ error: 'RFQ not found' });
//       }
//       res.json(rfq);
//     } catch (error) {
//       res.status(500).json({ error: 'Failed to fetch RFQ' });
//     }
//   }

//   async update(req: Request, res: Response) {
//     try {
//       const rfq = await RFQModel.findByIdAndUpdate(
//         req.params.id,
//         req.body,
//         { new: true }
//       );
//       if (!rfq) {
//         return res.status(404).json({ error: 'RFQ not found' });
//       }
//       res.json(rfq);
//     } catch (error) {
//       res.status(500).json({ error: 'Failed to update RFQ' });
//     }
//   }

//   async delete(req: Request, res: Response) {
//     try {
//       const rfq = await RFQModel.findByIdAndDelete(req.params.id);
//       if (!rfq) {
//         return res.status(404).json({ error: 'RFQ not found' });
//       }
//       res.json({ message: 'RFQ deleted successfully' });
//     } catch (error) {
//       res.status(500).json({ error: 'Failed to delete RFQ' });
//     }
//   }

//   // Get all suppliers for an RFQ
//   async getRFQSuppliers(req: Request, res: Response) {
//     try {
//       const rfq = await RFQModel.findById(req.params.id) as RFQDocument & { _id: mongoose.Types.ObjectId };
      
//       if (!rfq) {
//         return res.status(404).json({ message: 'RFQ not found' });
//       }
      
//       res.status(200).json(rfq.suppliers);
//     } catch (error) {
//       res.status(500).json({ message: 'Error fetching suppliers', error });
//     }
//   }

//   // Add a supplier to an RFQ
//   async addSupplierToRFQ(req: Request, res: Response) {
//     try {
//       const { id, name, email } = req.body;
      
//       if (!id || !name || !email) {
//         return res.status(400).json({ message: 'Supplier id, name, and email are required' });
//       }
      
//       const rfq = await RFQModel.findById(req.params.id) as RFQDocument & { _id: mongoose.Types.ObjectId };
      
//       if (!rfq) {
//         return res.status(404).json({ message: 'RFQ not found' });
//       }
      
//       // Check if supplier already exists
//       const supplierExists = rfq.suppliers?.some((supplier: Supplier) => 
//         supplier.id !== undefined && supplier.id === id);
      
//       if (supplierExists) {
//         return res.status(400).json({ message: 'Supplier already added to this RFQ' });
//       }
      
//       // Add supplier
//       if (!rfq.suppliers) {
//         rfq.suppliers = [];
//       }
//       rfq.suppliers.push({
//         id,
//         name,
//         email,
//         status: 'invited'
//       });
      
//       await rfq.save();
      
//       // Send invitation email to supplier with Excel attachment
//       if (email) {
//         await sendInvitationEmail(email, {
//           rfqId: rfq._id,
//           rfqTitle: rfq.generalDetails.title,
//           supplierName: name,
//           rfqData: rfq // Pass the entire RFQ data for Excel generation
//         });
//       } else {
//         console.warn(`Cannot send invitation email to supplier with ID ${id}: Email is missing`);
//       }
      
//       res.status(201).json(rfq.suppliers);
//     } catch (error) {
//       res.status(500).json({ message: 'Error adding supplier', error });
//     }
//   }

//   // Update supplier status
//   async updateSupplierStatus(req: Request, res: Response) {
//     try {
//       const { id, supplierId } = req.params;
//       const { status } = req.body;
      
//       const rfq = await RFQModel.findById(id);
      
//       if (!rfq) {
//         return res.status(404).json({ message: "RFQ not found" });
//       }
      
//       // Check if suppliers array exists
//       if (!rfq.suppliers || !Array.isArray(rfq.suppliers)) {
//         return res.status(404).json({ message: "Suppliers not found for this RFQ" });
//       }
      
//       const supplierIndex = rfq.suppliers.findIndex(s => s.id.toString() === supplierId);
      
//       if (supplierIndex === -1) {
//         return res.status(404).json({ message: "Supplier not found in this RFQ" });
//       }
      
//       // Update the supplier status
//       rfq.suppliers[supplierIndex].status = status;
      
//       // If status is 'responded', set the responseSubmittedAt date
//       if (status === 'responded') {
//         rfq.suppliers[supplierIndex].responseSubmittedAt = new Date();
//       }
      
//       await rfq.save();
      
//       res.status(200).json({
//         message: "Supplier status updated successfully",
//         supplier: rfq.suppliers[supplierIndex]
//       });
//     } catch (error) {
//       console.error('Error updating supplier status:', error);
//       res.status(500).json({ message: "Failed to update supplier status" });
//     }
//   }

//   // Remove supplier from RFQ
//   async removeSupplierFromRFQ(req: Request, res: Response) {
//     try {
//       const rfq = await RFQModel.findById(req.params.id) as RFQDocument & { _id: mongoose.Types.ObjectId };
      
//       if (!rfq) {
//         return res.status(404).json({ message: 'RFQ not found' });
//       }
      
//       if (!rfq.suppliers) {
//         return res.status(404).json({ message: "Suppliers not found for this RFQ" });
//       }
      
//       const supplierIndex = rfq.suppliers.findIndex(
//         (supplier: Supplier) => supplier.id?.toString() === req.params.supplierId
//       );
      
//       if (supplierIndex === -1) {
//         return res.status(404).json({ message: 'Supplier not found in this RFQ' });
//       }
      
//       // Remove supplier
//       rfq.suppliers.splice(supplierIndex, 1);
      
//       await rfq.save();
      
//       res.status(200).json({ message: 'Supplier removed successfully' });
//     } catch (error) {
//       res.status(500).json({ message: 'Error removing supplier', error });
//     }
//   }

//   /**
//    * Send RFQ to suppliers
//    */
//   async sendRFQToSuppliers(req: Request, res: Response) {
//     try {
//       const { id } = req.params;
//       const rfq = await RFQModel.findById(id);
      
//       if (!rfq) {
//         return res.status(404).json({ message: "RFQ not found" });
//       }
      
//       if (!rfq.suppliers || rfq.suppliers.length === 0) {
//         return res.status(404).json({ message: "No suppliers found for this RFQ" });
//       }
      
//       // Process each supplier
//       const results = await Promise.all(
//         rfq.suppliers.map(async (supplier) => {
//           try {
//             // Skip suppliers that have already been invited or responded
//             if (supplier.status === 'invited' || supplier.status === 'responded') {
//               return {
//                 email: supplier.email || 'unknown',
//                 status: 'skipped',
//                 message: 'Supplier already invited or has responded'
//               };
//             }
            
//             // Check if supplier has an email
//             if (!supplier.email) {
//               return {
//                 email: 'unknown',
//                 status: 'error',
//                 message: 'Supplier email is missing'
//               };
//             }
            
//             // Send invitation email with Excel attachment
//             await this.rfqService.generateAndSendExcel(
//               rfq._id.toString(),
//               supplier.email,
//               supplier.name || 'Supplier'
//             );
            
//             return {
//               email: supplier.email,
//               status: 'success',
//               message: 'Invitation sent successfully'
//             };
//           } catch (error: any) {
//             return {
//               email: supplier.email || 'unknown',
//               status: 'error',
//               message: error.message || 'Failed to send invitation'
//             };
//           }
//         })
//       );
      
//       res.status(200).json({
//         message: "RFQ sent to suppliers",
//         results
//       });
//     } catch (error) {
//       console.error('Error sending RFQ to suppliers:', error);
//       res.status(500).json({ message: "Failed to send RFQ to suppliers" });
//     }
//   }

//   public refreshRFQWithGemini = async (req: Request, res: Response): Promise<void> => {
//     try {
//       const { rfxId } = req.body;
      
//       if (!rfxId) {
//         res.status(400).json({ success: false, message: 'rfxId is required' });
//         return;
//       }
      
//       // Create form data for the request
//       const formData = new FormData();
//       formData.append('rfxId', rfxId);
      
//       // Make the request to the Gemini service using axios
//       const response = await axios.post(
//         'http://54.149.112.106:80/aerchain_kb_rfx_refresh_gemini', 
//         formData, 
//         {
//           headers: {
//             ...formData.getHeaders()
//           }
//         }
//       );
      
//       res.status(200).json({ 
//         success: true, 
//         message: 'RFQ data refreshed successfully with Gemini',
//         data: response.data
//       });
//     } catch (error: any) {
//       console.error('Error refreshing RFQ with Gemini:', error);
//       res.status(500).json({ 
//         success: false, 
//         message: 'Failed to refresh RFQ data with Gemini',
//         error: error.response?.data || error.message || 'Unknown error'
//       });
//     }
//   };

//   public chatWithGemini = async (req: Request, res: Response): Promise<void> => {
//     try {
//       // Debug the request
//       console.log('Headers:', req.headers);
//       console.log('Content-Type:', req.headers['content-type']);
//       console.log('Raw body:', req.body);
      
//       const { lastFiveUserTexts, currentText, rfxId } = req.body || {};
      
//       // Validate required fields
//       if (!currentText || !rfxId) {
//         res.status(400).json({ 
//           success: false, 
//           message: 'currentText and rfxId are required fields',
//           receivedBody: req.body
//         });
//         return;
//       }
      
//       // Prepare request data
//       const requestData = {
//         lastFiveUserTexts: lastFiveUserTexts || [],
//         currentText,
//         rfxId
//       };
      
//       // Set up response for streaming
//       res.setHeader('Content-Type', 'application/json');
//       res.setHeader('Transfer-Encoding', 'chunked');
      
//       // Send initial response
//       res.write(JSON.stringify({ 
//         status: 'processing',
//         message: 'Starting chat with Gemini',
//       }) + '\n');
      
//       // Make the request to the Gemini service using axios with responseType: 'stream'
//       const response = await axios({
//         method: 'post',
//         url: 'http://54.149.112.106:80/aerchain_kb_rfx_master_chat_streaming_10_gemini',
//         data: requestData,
//         headers: {
//           'Content-Type': 'application/json'
//         },
//         responseType: 'stream'
//       });
      
//       // Set up data handling for the stream
//       response.data.on('data', (chunk: Buffer) => {
//         try {
//           // Forward the chunk to the client
//           const chunkStr = chunk.toString();
//           res.write(JSON.stringify({
//             status: 'data',
//             chunk: chunkStr
//           }) + '\n');
//         } catch (error) {
//           console.error('Error processing stream chunk:', error);
//           res.write(JSON.stringify({
//             status: 'error',
//             message: 'Error processing stream chunk',
//             error: error instanceof Error ? error.message : 'Unknown error'
//           }) + '\n');
//         }
//       });
      
//       // Handle end of stream
//       response.data.on('end', () => {
//         res.write(JSON.stringify({
//           status: 'complete',
//           message: 'Chat stream completed'
//         }) + '\n');
//         res.end();
//       });
      
//       // Handle errors in the stream
//       response.data.on('error', (error: Error) => {
//         console.error('Stream error:', error);
//         res.write(JSON.stringify({
//           status: 'error',
//           message: 'Stream error occurred',
//           error: error.message
//         }) + '\n');
//         res.end();
//       });
      
//     } catch (error: any) {
//       console.error('Error in chat with Gemini:', error);
      
//       // Check if headers have already been sent
//       if (!res.headersSent) {
//         res.status(500).json({
//           success: false,
//           message: 'Failed to process chat request with Gemini',
//           error: error.response?.data || error.message || 'Unknown error'
//         });
//       } else {
//         // If headers already sent, we need to continue the stream with an error
//         res.write(JSON.stringify({
//           status: 'fatal_error',
//           message: 'An error occurred during processing',
//           error: error.message || 'Unknown error'
//         }) + '\n');
//         res.end();
//       }
//     }
//   };

//   public executeRFXCommands = async (req: Request, res: Response): Promise<void> => {
//     try {
//       const { rfxId, commands } = req.body;
      
//       // Validate required fields
//       if (!rfxId || !commands) {
//         res.status(400).json({ 
//           success: false, 
//           message: 'rfxId and commands are required fields' 
//         });
//         return;
//       }
      
//       // Create form data for the request
//       const formData = new FormData();
//       formData.append('rfxId', rfxId);
//       formData.append('commands', commands);
      
//       // Make the request to the Gemini service using axios
//       const response = await axios.post(
//         'http://54.149.112.106:80/aerchain_kb_rfx_update_commands_gemini',
//         formData,
//         {
//           headers: {
//             ...formData.getHeaders()
//           }
//         }
//       );
      
//       res.status(200).json({
//         success: true,
//         message: 'RFX commands executed successfully',
//         data: response.data
//       });
//     } catch (error: any) {
//       console.error('Error executing RFX commands:', error);
//       res.status(500).json({
//         success: false,
//         message: 'Failed to execute RFX commands',
//         error: error.response?.data || error.message || 'Unknown error'
//       });
//     }
//   };

//   /**
//    * Process document through multiple Gemini endpoints with streaming response
//    */
//   public processDocumentWithGemini = async (req: Request, res: Response): Promise<void> => {
//     try {
//       const { rfxId, files } = req.body;
//       console.log('req.body', req.body);
      
//       if (!rfxId || !files) {
//         res.status(400).json({ 
//           success: false, 
//           message: 'rfxId and files are required' 
//         });
//         return;
//       }
      
//       // Set headers for streaming response
//       res.setHeader('Content-Type', 'application/json');
//       res.setHeader('Transfer-Encoding', 'chunked');
//       res.setHeader('Cache-Control', 'no-cache');
//       res.setHeader('Connection', 'keep-alive');
      
//       // Send initial response
//       res.write(JSON.stringify({
//         success: true,
//         status: 'processing',
//         message: 'Starting document processing',
//         progress: 0,
//         timestamp: new Date().toISOString()
//       }));
      
//       // Get the file data
//       let fileData;
//       if (Array.isArray(files) && files.length > 0) {
//         fileData = files[0];
//       } else {
//         fileData = files;
//       }
      
//       // Check file structure
//       if (!fileData || !fileData.content) {
//         res.write(JSON.stringify({
//           success: false,
//           status: 'error',
//           message: 'Invalid file format: missing content',
//           timestamp: new Date().toISOString()
//         }));
//         res.end();
//         return;
//       }
      
//       // Extract file information
//       const fileName = fileData.name || 'document.pdf';
//       const fileType = fileData.type || 'application/pdf';
//       let fileBuffer;
      
//       // Handle base64 content
//       try {
//         if (fileData.content && typeof fileData.content === 'string') {
//           // Direct base64 string
//           const base64Data = fileData.content.includes('base64,') 
//             ? fileData.content.split('base64,')[1] 
//             : fileData.content;
          
//           fileBuffer = Buffer.from(base64Data, 'base64');
//         } else if (fileData.content && fileData.content.base64) {
//           // Object with base64 property
//           const base64Data = fileData.content.base64.includes('base64,') 
//             ? fileData.content.base64.split('base64,')[1] 
//             : fileData.content.base64;
          
//           fileBuffer = Buffer.from(base64Data, 'base64');
//         } else {
//           throw new Error('Unsupported file content format');
//         }
//       } catch (error: any) {
//         res.write(JSON.stringify({
//           success: false,
//           status: 'error',
//           message: `Error processing file: ${error.message}`,
//           timestamp: new Date().toISOString()
//         }));
//         res.end();
//         return;
//       }
      
//       // Send file preparation success message
//       res.write(JSON.stringify({
//         success: true,
//         status: 'processing',
//         chunk: 'Processing file, we will send you updates as we process it',
//         timestamp: new Date().toISOString()
//       }));
      
//       // Define the endpoints to call
//       const endpoints = [
//         'aerchain_kb_rfx_doc_read_1_gemini',
//         'aerchain_kb_rfx_doc_read_2_gemini',
//         'aerchain_kb_rfx_doc_read_3_gemini',
//         'aerchain_kb_rfx_doc_read_4_gemini',
//         'aerchain_kb_rfx_doc_read_5_gemini',
//         'aerchain_kb_rfx_doc_read_6_gemini',
//         'aerchain_kb_rfx_doc_read_7_gemini',
//         'aerchain_kb_rfx_doc_read_8_gemini',
//         'aerchain_kb_rfx_doc_read_9_gemini'
//       ];
      
//       // Process each endpoint sequentially
//       const results = [];
//       for (let i = 0; i < endpoints.length; i++) {
//         const endpoint = endpoints[i];
//         try {
//           console.log(`Processing endpoint: ${endpoint}`);
          
//           // Send progress update
//           res.write(JSON.stringify({
//             success: true,
//             status: 'processing',
//             message: `Processing endpoint ${i+1}/${endpoints.length}: ${endpoint}`,
//             progress: 5 + ((i / endpoints.length) * 90), // 5% for prep, 90% for processing
//             timestamp: new Date().toISOString()
//           }));
          
//           // Create a new FormData for each request
//           const formData = new FormData();
//           formData.append('rfxId', rfxId);
          
//           // Append the file as a Buffer with filename
//           formData.append('file', fileBuffer, {
//             filename: fileName,
//             contentType: fileType
//           });
          
//           // Make the request to the Gemini service
//           const response = await axios.post(
//             `http://54.149.112.106:80/${endpoint}`, 
//             formData, 
//             {
//               headers: {
//                 ...formData.getHeaders()
//               }
//             }
//           );
          
//           // Create a safe result object
//           const result = {
//             endpoint,
//             status: 'success',
//             data: response.data
//           };
          
//           results.push(result);
          
//           // Send the result for this endpoint
//           res.write(JSON.stringify({
//             status: 'data',
//             chunk: response.data.toString()
//           }));
          
//         } catch (error: any) {
//           console.error(`Error processing endpoint ${endpoint}:`, error);
          
//           // Create a safe error object without circular references
//           const safeError = {
//             message: error.message || 'Unknown error',
//             status: error.response?.status,
//             data: error.response?.data
//           };
          
//           const result = {
//             endpoint,
//             status: 'error',
//             error: safeError
//           };
          
//           results.push(result);
          
//           // Send the error for this endpoint
//           res.write(JSON.stringify({
//             success: true, // Keep success true to continue processing
//             status: 'processing',
//             message: `Error in endpoint ${i+1}/${endpoints.length}: ${endpoint}`,
//             progress: 5 + (((i + 1) / endpoints.length) * 90),
//             error: safeError,
//             timestamp: new Date().toISOString()
//           }));
//         }
//       }
      
//       // Send final completion message
//       res.write(JSON.stringify({
//         success: true,
//         status: 'complete',
//         message: 'Document processing completed',
//         progress: 100,
//         results,
//         timestamp: new Date().toISOString()
//       }));
      
//       // End the response
//       res.end();
      
//     } catch (error: any) {
//       console.error('Error processing document with Gemini:', error);
      
//       // Create a safe error response
//       const safeError = {
//         message: error.message || 'Unknown error'
//       };
      
//       // If headers haven't been sent yet, send a regular JSON response
//       if (!res.headersSent) {
//         res.status(500).json({
//           success: false,
//           status: 'error',
//           message: 'Failed to process document with Gemini',
//           error: safeError
//         });
//       } else {
//         // Otherwise, send an error event and end the stream
//         res.write(JSON.stringify({
//           success: false,
//           status: 'error',
//           message: 'Failed to process document with Gemini',
//           error: safeError,
//           timestamp: new Date().toISOString()
//         }));
//         res.end();
//       }
//     }
//   };

//   public generateEmailWithGemini = async (req: Request, res: Response): Promise<void> => {
//     try {
//       const { rfxId, senderName } = req.body;
      
//       // Validate required fields
//       if (!rfxId || !senderName) {
//         res.status(400).json({ 
//           success: false, 
//           message: 'rfxId and senderName are required fields' 
//         });
//         return;
//       }
      
//       // Create form data for the request
//       const formData = new FormData();
//       formData.append('rfxId', rfxId);
//       formData.append('senderName', senderName);
      
//       // Make the request to the Gemini service using axios
//       const response = await axios.post(
//         'http://54.149.112.106:80/aerchain_kb_rfx_generate_email_gemini',
//         formData,
//         {
//           headers: {
//             ...formData.getHeaders()
//           }
//         }
//       );
      
//       res.status(200).json({
//         success: true,
//         message: 'Email generated successfully with Gemini',
//         data: response
//       });
//     } catch (error: any) {
//       console.error('Error generating email with Gemini:', error);
//       res.status(500).json({
//         success: false,
//         message: 'Failed to generate email with Gemini',
//         error: error.response?.data || error.message || 'Unknown error'
//       });
//     }
//   };

//   /**
//    * Generate Excel file for an RFQ and send it to suppliers
//    */
//   public generateAndSendRFQExcel = async (req: Request, res: Response): Promise<void> => {
//     try {
//       const { rfqId, supplierEmails } = req.body;
      
//       // Validate required fields
//       if (!rfqId || !supplierEmails || !Array.isArray(supplierEmails)) {
//         res.status(400).json({ 
//           success: false, 
//           message: 'RFQ ID and supplier emails array are required' 
//         });
//         return;
//       }
      
//       // Find the RFQ
//       const rfq = await this.rfqService.findById(rfqId);
//       if (!rfq) {
//         res.status(404).json({
//           success: false,
//           message: `RFQ with ID ${rfqId} not found`
//         });
//         return;
//       }
      
//       // Send Excel files to the specified suppliers
//       const results = await Promise.all(
//         supplierEmails.map(async (email: string) => {
//           try {
//             // Find the supplier in the RFQ
//             const supplier = rfq.suppliers.find((s: Supplier) => s.email === email);
//             if (!supplier) {
//               return {
//                 email,
//                 status: 'error',
//                 message: 'Supplier not found in RFQ'
//               };
//             }
            
//             // Send invitation email with Excel attachment
//             await sendInvitationEmail(email, {
//               rfqId: rfq._id,
//               rfqTitle: rfq.title,
//               supplierName: supplier.name || 'Supplier'
//             });
            
//             return {
//               email,
//               status: 'success',
//               message: 'Excel sent successfully'
//             };
//           } catch (error: any) {
//             console.error(`Error sending Excel to ${email}:`, error);
//             return {
//               email,
//               status: 'error',
//               message: error.message || 'Failed to send Excel'
//             };
//           }
//         })
//       );
      
//       res.status(200).json({
//         success: true,
//         message: 'RFQ Excel files sent to suppliers',
//         results
//       });
//     } catch (error: any) {
//       console.error('Error generating and sending RFQ Excel:', error);
//       res.status(500).json({
//         success: false,
//         message: 'Failed to generate and send RFQ Excel',
//         error: error.message || 'Unknown error'
//       });
//     }
//   };

//   /**
//    * Generate Excel file for an RFQ and return it for download
//    */
//   public generateRFQExcel = async (req: Request, res: Response): Promise<void> => {
//     try {
//       const rfqId = req.params.id;
      
//       // Validate required fields
//       if (!rfqId) {
//         res.status(400).json({ 
//           success: false, 
//           message: 'RFQ ID is required' 
//         });
//         return;
//       }
      
//       // Find the RFQ
//       const rfq = await this.rfqService.findById(rfqId);
//       if (!rfq) {
//         res.status(404).json({
//           success: false,
//           message: `RFQ with ID ${rfqId} not found`
//         });
//         return;
//       }
      
//       // Generate Excel file
//       let templateStructure = null;
//       if (rfq.template && rfq.template.processedStructure) {
//         templateStructure = rfq.template.processedStructure;
//       }
      
//       const excelFilePath = await this.rfqService.generateRFQExcel(rfq, templateStructure);
      
//       // Set headers for file download
//       res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
//       res.setHeader('Content-Disposition', `attachment; filename=RFQ-${rfq.title.replace(/[^a-zA-Z0-9]/g, '-')}.xlsx`);
      
//       // Send the file
//       res.sendFile(excelFilePath, (err) => {
//         if (err) {
//           console.error('Error sending Excel file:', err);
//           res.status(500).end();
//         }
        
//         // Clean up the temporary file after sending
//         fs.unlink(excelFilePath, (unlinkErr) => {
//           if (unlinkErr) {
//             console.error('Error deleting temporary Excel file:', unlinkErr);
//           }
//         });
//       });
//     } catch (error: any) {
//       console.error('Error generating RFQ Excel:', error);
//       res.status(500).json({
//         success: false,
//         message: 'Failed to generate RFQ Excel',
//         error: error.message || 'Unknown error'
//       });
//     }
//   };

//   /**
//    * Download Excel file for a supplier for a specific RFQ
//    */
//   async downloadSupplierExcel(req: Request, res: Response): Promise<void> {
//     try {
//       const { rfqId, supplierId } = req.params;
      
//       // Validate parameters
//       if (!rfqId || !supplierId) {
//         res.status(400).json({
//           success: false,
//           message: 'RFQ ID and Supplier ID are required'
//         });
//         return;
//       }
      
//       // Get the Excel file path
//       const excelFilePath = await this.rfqService.getSupplierExcelFile(rfqId, supplierId);
      
//       // Find the RFQ to get supplier info
//       const rfq = await this.rfqService.findById(rfqId);
//       if (!rfq) {
//         res.status(404).json({
//           success: false,
//           message: `RFQ with ID ${rfqId} not found`
//         });
//         return;
//       }
      
//       // Find the supplier
//       const supplier = rfq.suppliers?.find((s: Supplier) => s.id.toString() === supplierId);
//       if (!supplier) {
//         res.status(404).json({
//           success: false,
//           message: `Supplier with ID ${supplierId} not found in RFQ ${rfqId}`
//         });
//         return;
//       }
      
//       const supplierName = supplier.name || 'supplier';
//       const rfqTitle = rfq.title || 'rfq';
      
//       // Set headers for file download
//       res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
//       res.setHeader('Content-Disposition', `attachment; filename=RFQ-${rfqTitle.replace(/[^a-zA-Z0-9]/g, '-')}-${supplierName.replace(/[^a-zA-Z0-9]/g, '-')}.xlsx`);
      
//       // Send the file
//       res.sendFile(excelFilePath, (err) => {
//         if (err) {
//           console.error('Error sending Excel file:', err);
//           res.status(500).end();
//         }
//       });
//     } catch (error: any) {
//       console.error('Error downloading supplier Excel:', error);
//       res.status(500).json({
//         success: false,
//         message: 'Failed to download supplier Excel',
//         error: error.message || 'Unknown error'
//       });
//     }
//   };

//   /**
//    * Process Excel file uploaded by supplier
//    */
//   async processSupplierExcel(req: Request, res: Response): Promise<void> {
//     try {
//       const { rfqId, supplierId } = req.params;
      
//       if (!req.file) {
//         res.status(400).json({ success: false, message: 'No file uploaded' });
//         return;
//       }
      
//       // Process the uploaded Excel file using the buffer instead of the path
//       const processedData = await this.rfqService.processSupplierExcel(
//         rfqId, 
//         supplierId, 
//         req.file.buffer // Pass the buffer instead of the path
//       );
      
//       // Store the processed data
//       await this.rfqService.storeSupplierResponse(rfqId, supplierId, processedData);
      
//       res.status(200).json({ 
//         success: true, 
//         message: 'Excel file processed successfully',
//         data: processedData
//       });
//     } catch (error: unknown) {
//       console.error('Error processing supplier Excel:', error);
      
//       // Safely handle the error message
//       const errorMessage = error instanceof Error 
//         ? error.message 
//         : 'Unknown error occurred';
      
//       res.status(500).json({ 
//         success: false, 
//         message: 'Error processing Excel file',
//         error: errorMessage
//       });
//     }
//   }
// }