const nodemailer = require('nodemailer');
const ExcelJS = require('exceljs');
const fs = require('fs');
const path = require('path');
const os = require('os');
import { config } from '../config';
import { RFQDocument } from '../types/rfq';

// Define interfaces for the data structures
interface Column {
  header: string;
  key: string;
  width: number;
}

interface Cell {
  protection: {
    locked: boolean;
  };
  value: any;
}

interface MailOptions {
  from: string;
  to: string;
  subject: string;
  html: string;
  attachments?: Array<{
    filename: string;
    path: string;
  }>;
}

// Define types for nodemailer
interface Transporter {
  sendMail: (options: MailOptions) => Promise<{ messageId: string }>;
  verify?: (callback: (error: Error | null, success: boolean) => void) => void;
}

// Create transporter with fallback for missing config
let transporter: Transporter;
try {
  transporter = nodemailer.createTransport({
    host: config.email?.host || 'smtp.gmail.com',
    port: config.email?.port || 587,
    secure: config.email?.secure || false,
    auth: {
      user: config.email?.user || '',
      pass: config.email?.password || ''
    }
  });
  
  // Verify the connection configuration
  transporter.verify?.(function(error: Error | null, success: boolean) {
    if (error) {
      console.error('SMTP connection error:', error);
      console.log('Will use mock email service instead');
      
      // Replace with mock transporter
      transporter = {
        sendMail: async (options: MailOptions) => {
          console.log('Email would be sent (mock):', JSON.stringify(options, null, 2));
          return { messageId: 'mock-id-' + Date.now() };
        }
      };
    } else {
      console.log('SMTP server is ready to take our messages');
    }
  });
} catch (error) {
  console.error('Failed to create email transporter:', error);
  // Create a mock transporter that logs instead of sending
  transporter = {
    sendMail: async (options: MailOptions) => {
      console.log('Email would be sent (mock):', options);
      return { messageId: 'mock-id-' + Date.now() };
    }
  };
}

// Define interfaces for field types
interface Field {
  id?: string;
  label?: string;
  type?: string;
  value?: any;
  required?: boolean;
}

interface Subsection {
  id?: string;
  title?: string;
  fields?: Field[];
}

// Update the ExcelCell interface to be used for cell parameters
interface ExcelCell {
  protection: {
    locked: boolean;
  };
  value: any;
  font?: any;
  fill?: any;
}

// Generate Excel file for RFQ
async function generateRFQExcel(rfq: RFQDocument): Promise<string> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'RFQ System';
  workbook.lastModifiedBy = 'RFQ System';
  workbook.created = new Date();
  workbook.modified = new Date();
  
  // Add Instructions sheet as the first sheet
  const instructionsSheet = workbook.addWorksheet('Instructions');
  instructionsSheet.protection = { sheet: true, password: 'rfq-protected' };
  
  instructionsSheet.columns = [
    { header: 'Instructions for Suppliers', key: 'instructions', width: 100 }
  ];
  
  // Add a title with styling
  const titleRow = instructionsSheet.addRow(['How to Complete This RFQ Response']);
  titleRow.font = { bold: true, size: 14 };
  titleRow.height = 24;
  
  instructionsSheet.addRow([]); // Empty row for spacing
  
  // Add detailed instructions
  instructionsSheet.addRow({ instructions: 'This Excel file contains the details of the Request for Quotation (RFQ).' });
  instructionsSheet.addRow({ instructions: 'Please follow these instructions to submit your response:' });
  instructionsSheet.addRow({ instructions: '' });
  instructionsSheet.addRow({ instructions: '1. Review all sheets to understand the requirements.' });
  instructionsSheet.addRow({ instructions: '2. The "Questionnaire" and "Items" sheets are editable in specific columns.' });
  instructionsSheet.addRow({ instructions: '3. Enter your responses in the "Your Response" column in the Questionnaire sheet.' });
  instructionsSheet.addRow({ instructions: '4. Enter your pricing in the "Your Quote (Price)" column in the Items sheet.' });
  instructionsSheet.addRow({ instructions: '5. Save the file with your company name in the filename.' });
  instructionsSheet.addRow({ instructions: '6. Reply to the email with this completed Excel file attached.' });
  instructionsSheet.addRow({ instructions: '7. Ensure your response is submitted before the deadline.' });
  
  instructionsSheet.addRow([]); // Empty row for spacing
  
  // Add sheet descriptions
  const sheetDescRow = instructionsSheet.addRow(['Sheet Descriptions:']);
  sheetDescRow.font = { bold: true };
  
  instructionsSheet.addRow({ instructions: '• Instructions (this sheet): Provides guidance on how to complete your response.' });
  instructionsSheet.addRow({ instructions: '• General Details: Contains basic information about the RFQ.' });
  instructionsSheet.addRow({ instructions: '• Scope of Work: Describes the detailed requirements and specifications.' });
  
  // Add descriptions for questionnaire sheets if they exist
  if (rfq.questionnaire && rfq.questionnaire.length > 0) {
    rfq.questionnaire.forEach((section: any, index: number) => {
      instructionsSheet.addRow({ 
        instructions: `• Questionnaire - ${section.title || index + 1}: Contains questions requiring your response.` 
      });
    });
  }
  
  // Add descriptions for items sheets if they exist
  if (rfq.items && rfq.items.length > 0) {
    rfq.items.forEach((section: any, index: number) => {
      instructionsSheet.addRow({ 
        instructions: `• Items - ${section.title || index + 1}: Contains items requiring your pricing.` 
      });
    });
  }
  
  instructionsSheet.addRow({ instructions: '• Terms and Conditions: Contains the terms and conditions for this RFQ.' });
  
  instructionsSheet.addRow([]); // Empty row for spacing
  
  // Add important notes
  const notesRow = instructionsSheet.addRow(['Important Notes:']);
  notesRow.font = { bold: true };
  
  instructionsSheet.addRow({ instructions: '• Only edit cells that are unlocked (typically in the "Your Response" or "Your Quote" columns).' });
  instructionsSheet.addRow({ instructions: '• Do not modify the structure of the sheets or add/remove rows or columns.' });
  instructionsSheet.addRow({ instructions: '• If you have questions about the RFQ, please contact the procurement team.' });
  instructionsSheet.addRow({ instructions: '• Incomplete responses may be disqualified.' });
  
  // Apply some styling to make the instructions more readable
  instructionsSheet.getColumn('instructions').width = 100;
  instructionsSheet.getRow(1).height = 30;
  
  // Now add the rest of the sheets
  
  // Add General Details sheet (read-only)
  const generalSheet = workbook.addWorksheet('General Details');
  generalSheet.protection = { sheet: true, password: 'rfq-protected' };
  
  generalSheet.columns = [
    { header: 'Field', key: 'field', width: 30 },
    { header: 'Value', key: 'value', width: 50 }
  ];
  
  // Add general details - dynamically process all fields and subsections
  if (rfq.generalDetails) {
    // Add title and status
    generalSheet.addRow({ field: 'Title', value: rfq.generalDetails.title || '' });
    generalSheet.addRow({ field: 'Status', value: rfq.generalDetails.status || '' });
    
    // Add all fields
    if (Array.isArray(rfq.generalDetails.fields)) {
      rfq.generalDetails.fields.forEach(field => {
        if (field.label && (field.value !== undefined && field.value !== null)) {
          generalSheet.addRow({ 
            field: field.label, 
            value: formatFieldValue(field.value, field.type) 
          });
        }
      });
    }
    
    // Add all subsections and their fields
    if (Array.isArray(rfq.generalDetails.subsections)) {
      rfq.generalDetails.subsections.forEach((subsection: Subsection) => {
        // Add subsection header
        generalSheet.addRow({ field: `${subsection.title} (Section)`, value: '' });
        
        // Add subsection fields
        if (Array.isArray(subsection.fields)) {
          subsection.fields.forEach((field: Field) => {
            if (field.label && (field.value !== undefined && field.value !== null)) {
              generalSheet.addRow({ 
                field: `  - ${field.label}`, // Indent subsection fields
                value: formatFieldValue(field.value, field.type) 
              });
            }
          });
        }
      });
    }
    
    // Add any other properties that might be in generalDetails
    Object.entries(rfq.generalDetails).forEach(([key, value]) => {
      // Skip fields and subsections as they're already processed
      if (key !== 'fields' && key !== 'subsections' && key !== 'title' && key !== 'status') {
        if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
          generalSheet.addRow({ 
            field: key.charAt(0).toUpperCase() + key.slice(1).replace(/([A-Z])/g, ' $1'), 
            value: value 
          });
        }
      }
    });
  }
  
  // Add Scope of Work sheet (read-only)
  if (rfq.scopeOfWork && rfq.scopeOfWork.length > 0) {
    const sowSheet = workbook.addWorksheet('Scope of Work');
    sowSheet.protection = { sheet: true, password: 'rfq-protected' };
    
    sowSheet.columns = [
      { header: 'Section', key: 'section', width: 30 },
      { header: 'Subsection', key: 'subsection', width: 30 },
      { header: 'Heading', key: 'heading', width: 30 },
      { header: 'Content', key: 'content', width: 70 }
    ];
    
    rfq.scopeOfWork.forEach((section: any) => {
      // Add section content
      if (section.content && Array.isArray(section.content)) {
        section.content.forEach((item: any) => {
          sowSheet.addRow({ 
            section: section.title || '',
            subsection: '',
            heading: item.heading || '',
            content: stripHtml(item.description || '')
          });
        });
      }
      
      // Add subsections and their content
      if (section.sections && Array.isArray(section.sections)) {
        section.sections.forEach((subsection: any) => {
          if (subsection.content && Array.isArray(subsection.content)) {
            subsection.content.forEach((item: any) => {
              sowSheet.addRow({ 
                section: section.title || '',
                subsection: subsection.title || '',
                heading: item.heading || '',
                content: stripHtml(item.description || '')
              });
            });
          }
        });
      }
    });
  }
  
  // Add Questionnaire sheet (editable)
  if (rfq.questionnaire && rfq.questionnaire.length > 0) {
    rfq.questionnaire.forEach((section: any, sectionIndex: number) => {
      const questionnaireSheet = workbook.addWorksheet(`Questionnaire - ${section.title || sectionIndex + 1}`);
      
      // Create columns based on the section's columns
      let columns: Column[] = [];
      
      // If section has columns defined, use them
      if (section.columns && Array.isArray(section.columns)) {
        columns = section.columns.map((col: any) => ({
          header: col.header || col.id || '',
          key: col.accessorKey || col.id || `col_${Math.random().toString(36).substring(2, 9)}`,
          width: 20
        }));
      } else {
        // Default columns if not defined
        columns = [
          { header: 'Question', key: 'question', width: 40 },
          { header: 'Type', key: 'type', width: 15 },
          { header: 'Required', key: 'required', width: 10 },
          { header: 'Options', key: 'options', width: 30 }
        ];
      }
      
      // Add response column if not present
      if (!columns.find((col: Column) => col.key === 'response')) {
        columns.push({ header: 'Your Response', key: 'response', width: 30 });
      }
      
      questionnaireSheet.columns = columns;
      
      // Add header row with styling
      const headerRow = questionnaireSheet.getRow(1);
      headerRow.font = { bold: true };
      headerRow.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFE0E0E0' }
      };
      
      // Add data rows
      if (section.data && Array.isArray(section.data)) {
        section.data.forEach((item: any, rowIndex: number) => {
          const rowData: Record<string, any> = {};
          
          // Map each column to its value in the item
          columns.forEach((col: Column) => {
            if (col.key === 'options' && Array.isArray(item.options)) {
              rowData[col.key] = item.options.join(', ');
            } else if (col.key === 'response') {
              rowData[col.key] = ''; // Empty response cell for the supplier to fill
            } else {
              rowData[col.key] = item[col.key] !== undefined ? item[col.key] : '';
            }
          });
          
          const dataRow = questionnaireSheet.addRow(rowData);
          
          // Apply styling to the row
          dataRow.eachCell((cell: ExcelCell, colNumber: number) => {
            // Only the response column should be editable
            if (columns[colNumber - 1]?.key === 'response') {
              cell.protection = { locked: false };
            } else {
              cell.protection = { locked: true };
            }
          });
        });
      }
      
      // Apply sheet protection with some cells unlocked
      questionnaireSheet.protection = {
        sheet: true,
        password: 'rfq-protected',
        formatCells: false,
        formatColumns: false,
        formatRows: false,
        deleteRows: false,
        sort: false,
        autoFilter: false,
        pivotTables: false
      };
    });
  }
  
  // Add Items sheet (editable)
  if (rfq.items && rfq.items.length > 0) {
    rfq.items.forEach((section: any, sectionIndex: number) => {
      // Create a sheet for each section
      const sectionSheet = workbook.addWorksheet(`Items - ${section.title || sectionIndex + 1}`);
      
      // If section has tables, process each table
      if (section.tables && Array.isArray(section.tables)) {
        section.tables.forEach((table: any, tableIndex: number) => {
          // Skip empty tables
          if (!table.columns || !table.data) {
            return;
          }
          
          // Add table title
          const titleRow = sectionSheet.addRow([`Table ${tableIndex + 1}: ${table.title || ''}`]);
          titleRow.font = { bold: true, size: 14 };
          sectionSheet.addRow([]); // Empty row for spacing
          
          // Create columns
          const columns: Column[] = table.columns.map((col: any) => ({
            header: col.header || col.id || '',
            key: col.accessorKey || col.id || `col_${Math.random().toString(36).substring(2, 9)}`,
            width: 20
          }));
          
          // Add price/quote column if not present
          if (!columns.find((col: Column) => col.key.includes('price') || col.key.includes('quote'))) {
            columns.push({ header: 'Your Quote (Price)', key: 'quote', width: 20 });
          }
          
          // Add header row
          const headerRow = sectionSheet.addRow(columns.map((col: Column) => col.header));
          headerRow.font = { bold: true };
          headerRow.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFE0E0E0' }
          };
          
          // Add data rows
          if (table.data && Array.isArray(table.data)) {
            table.data.forEach((item: any) => {
              const rowData = columns.map((col: Column) => {
                if (col.key === 'quote') {
                  return ''; // Empty quote cell for the supplier to fill
                }
                return item[col.key] !== undefined ? item[col.key] : '';
              });
              
              const dataRow = sectionSheet.addRow(rowData);
              
              // Apply styling to the row
              dataRow.eachCell((cell: ExcelCell, colNumber: number) => {
                const colKey = columns[colNumber - 1]?.key;
                // Only the quote/price column should be editable
                if (colKey && (colKey.includes('price') || colKey.includes('quote'))) {
                  cell.protection = { locked: false };
                } else {
                  cell.protection = { locked: true };
                }
              });
            });
          }
          
          sectionSheet.addRow([]); // Empty row for spacing between tables
          sectionSheet.addRow([]); // Empty row for spacing between tables
        });
      }
      
      // Apply sheet protection with some cells unlocked
      sectionSheet.protection = {
        sheet: true,
        password: 'rfq-protected',
        formatCells: false,
        formatColumns: false,
        formatRows: false,
        insertColumns: false,
        insertRows: false,
        insertHyperlinks: false,
        deleteColumns: false,
        deleteRows: false,
        sort: false,
        autoFilter: false,
        pivotTables: false
      };
    });
  }
  
  // Add Terms and Conditions sheet (read-only)
  if (rfq.termsAndConditions) {
    const termsSheet = workbook.addWorksheet('Terms and Conditions');
    termsSheet.protection = { sheet: true, password: 'rfq-protected' };
    
    termsSheet.columns = [
      { header: 'Term', key: 'term', width: 30 },
      { header: 'Description', key: 'description', width: 70 }
    ];
    
    // Add terms and conditions - handle both object and array formats
    if (typeof rfq.termsAndConditions === 'object') {
      // If it's an object with fields and subsections
      if (rfq.termsAndConditions.fields && Array.isArray(rfq.termsAndConditions.fields)) {
        rfq.termsAndConditions.fields.forEach(field => {
          if (field.label && (field.value !== undefined && field.value !== null)) {
            termsSheet.addRow({ 
              term: field.label, 
              description: formatFieldValue(field.value, field.type) 
            });
          }
        });
      }
      
      // Add subsections
      if (rfq.termsAndConditions.subsections && Array.isArray(rfq.termsAndConditions.subsections)) {
        rfq.termsAndConditions.subsections.forEach((subsection: Subsection) => {
          // Add subsection header
          termsSheet.addRow({ term: `${subsection.title} (Section)`, description: '' });
          
          // Add subsection fields
          if (subsection.fields && Array.isArray(subsection.fields)) {
            subsection.fields.forEach((field: Field) => {
              if (field.label && (field.value !== undefined && field.value !== null)) {
                termsSheet.addRow({ 
                  term: `  - ${field.label}`, // Indent subsection fields
                  description: formatFieldValue(field.value, field.type) 
                });
              }
            });
          }
        });
      }
      
      // Add any other properties
      Object.entries(rfq.termsAndConditions).forEach(([key, value]) => {
        // Skip fields and subsections as they're already processed
        if (key !== 'fields' && key !== 'subsections' && key !== 'timestamp') {
          if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
            termsSheet.addRow({ 
              term: key.charAt(0).toUpperCase() + key.slice(1).replace(/([A-Z])/g, ' $1'), 
              description: value 
            });
          }
        }
      });
    } else {
      // Fallback for simple object format
      Object.entries(rfq.termsAndConditions).forEach(([key, value]) => {
        if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
          termsSheet.addRow({ 
            term: key.charAt(0).toUpperCase() + key.slice(1).replace(/([A-Z])/g, ' $1'), 
            description: value 
          });
        }
      });
    }
  }
  
  // Create a temporary file path
  const tempFilePath = path.join(os.tmpdir(), `rfq-${rfq._id}-${Date.now()}.xlsx`);
  
  // Write to file
  await workbook.xlsx.writeFile(tempFilePath);
  
  return tempFilePath;
}

// Helper function to format field values based on type
function formatFieldValue(value: any, type?: string): string {
  if (value === undefined || value === null) {
    return '';
  }
  
  if (type === 'date' && value) {
    // Try to format as date if it's a valid date
    try {
      const date = new Date(value);
      if (!isNaN(date.getTime())) {
        return date.toLocaleDateString();
      }
    } catch (e) {
      // If date parsing fails, return as is
    }
  }
  
  if (Array.isArray(value)) {
    return value.join(', ');
  }
  
  if (typeof value === 'object') {
    return JSON.stringify(value);
  }
  
  return String(value);
}

// Helper function to strip HTML tags
function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, '');
}

// Send invitation email to supplier with Excel attachment
export const sendInvitationEmail = async (email: string, data: any) => {
  const { rfqId, rfqTitle, supplierName, rfqData } = data;
  
  // Generate Excel file if rfqData is provided
  let excelFilePath = null;
  if (rfqData) {
    excelFilePath = await generateRFQExcel(rfqData);
  }
  
  const mailOptions: MailOptions = {
    from: config.email.from,
    to: email,
    subject: `Invitation to respond to RFQ: ${rfqTitle}`,
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>RFQ Invitation</title>
        <style>
          body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            line-height: 1.6;
            color: #333;
            margin: 0;
            padding: 0;
            background-color: #f9f9f9;
          }
          .container {
            max-width: 600px;
            margin: 0 auto;
            padding: 20px;
            background-color: #ffffff;
            border-radius: 8px;
            box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
          }
          .header {
            text-align: center;
            padding: 20px 0;
            border-bottom: 1px solid #eaeaea;
          }
          .logo {
            max-width: 180px;
            height: auto;
          }
          .content {
            padding: 20px 0;
          }
          h1 {
            color: #2c3e50;
            font-size: 24px;
            margin-top: 0;
          }
          .rfq-title {
            background-color: #f8f9fa;
            padding: 15px;
            border-radius: 5px;
            margin: 20px 0;
            border-left: 4px solid #3498db;
          }
          .button {
            display: inline-block;
            background-color: #3498db;
            color: white;
            text-decoration: none;
            padding: 12px 25px;
            border-radius: 4px;
            margin: 20px 0;
            font-weight: 600;
          }
          .button:hover {
            background-color: #2980b9;
          }
          .footer {
            text-align: center;
            padding-top: 20px;
            border-top: 1px solid #eaeaea;
            color: #7f8c8d;
            font-size: 12px;
          }
          .note {
            background-color: #fef9e7;
            padding: 15px;
            border-radius: 5px;
            margin: 20px 0;
            border-left: 4px solid #f1c40f;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <img src="https://aerchain.io/wp-content/uploads/2023/03/aerchain-logo.png" alt="Aerchain Logo" class="logo">
          </div>
          
          <div class="content">
            <h1>Request for Quotation Invitation</h1>
            
            <p>Dear <strong>${supplierName}</strong>,</p>
            
            <p>You have been invited to participate in the following Request for Quotation:</p>
            
            <div class="rfq-title">
              <h2>${rfqTitle}</h2>
              <p>RFQ ID: ${rfqId}</p>
            </div>
            
            <p>We believe your company's expertise and services align well with our requirements for this project.</p>
            
            <p>Please find attached an Excel file containing the complete RFQ details and response templates. The file includes:</p>
            
            <ul>
              <li>General project information</li>
              <li>Detailed scope of work</li>
              <li>Questionnaire sections requiring your input</li>
              <li>Pricing tables for your quotation</li>
              <li>Terms and conditions</li>
            </ul>
            
            <div class="note">
              <p><strong>Important:</strong> Please follow the instructions in the "Instructions" sheet to complete your response correctly.</p>
            </div>
            
            <p>You can also view and respond to this RFQ through our online portal:</p>
            
            <center>
              <a href="${config.appUrl}/supplier/rfq/${rfqId}" class="button">View RFQ Online</a>
            </center>
            
            <p>Please submit your response by either:</p>
            <ol>
              <li>Replying to this email with the completed Excel file attached</li>
              <li>Submitting through our online portal</li>
            </ol>
            
            <p>If you have any questions regarding this RFQ, please don't hesitate to contact us by replying to this email.</p>
            
            <p>Thank you for your interest in working with us.</p>
            
            <p>Best regards,<br>
            The Procurement Team</p>
          </div>
          
          <div class="footer">
            <p>This is an automated message from the Aerchain RFQ System.</p>
            <p>© ${new Date().getFullYear()} Aerchain. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `
  };
  
  // Add attachment if Excel file was generated
  if (excelFilePath) {
    mailOptions.attachments = [
      {
        filename: `RFQ-${rfqTitle.replace(/[^a-zA-Z0-9]/g, '-')}.xlsx`,
        path: excelFilePath
      }
    ];
  }
  
  try {
    const result = await transporter.sendMail(mailOptions);
    
    // Clean up temporary file
    if (excelFilePath) {
      fs.unlinkSync(excelFilePath);
    }
    
    return result;
  } catch (error) {
    // Clean up temporary file in case of error
    if (excelFilePath && fs.existsSync(excelFilePath)) {
      fs.unlinkSync(excelFilePath);
    }
    throw error;
  }
}; 