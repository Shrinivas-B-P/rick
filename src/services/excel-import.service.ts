import ExcelJS from 'exceljs';
import { RFQService } from './rfq.service';
import { SQRModel, SQRDocument } from '../models/sqr.model';
import { AppError } from '../utils/error';
import mongoose from 'mongoose';
import fs from 'fs';

export class ExcelImportService {
  private rfqService: RFQService;

  constructor() {
    this.rfqService = new RFQService();
  }

  /**
   * Import data from an Excel file and update the SQR
   * @param filePath Path to the Excel file
   * @param sqrId ID of the SQR to update
   * @returns Updated SQR document
   */
  async importSQRFromExcel(filePath: string, sqrId: string): Promise<SQRDocument> {
    try {
      // Find the SQR
      const sqr = await SQRModel.findById(sqrId);
      if (!sqr) {
        throw new AppError(404, `SQR with ID ${sqrId} not found`);
      }

      // Load the workbook
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.readFile(filePath);

      // Process each worksheet
      const extractedData: any = {
        sections: [],
        totalQuoteValue: null,
        currency: null,
        comments: ''
      };

      // Skip the Instructions sheet
      for (let i = 1; i < workbook.worksheets.length; i++) {
        const worksheet = workbook.worksheets[i];
        const sheetName = worksheet.name;

        // Find the corresponding section in the SQR
        const sectionIndex = sqr.sections.findIndex(section => 
          section.title.toLowerCase() === sheetName.toLowerCase()
        );

        if (sectionIndex !== -1) {
          const section = sqr.sections[sectionIndex];
          const extractedSection = await this.extractDataFromWorksheet(worksheet, section);
          
          // Update the section in the SQR
          sqr.sections[sectionIndex] = {
            ...section.toObject(),
            ...extractedSection
          };

          // Check if this is the Quote Summary section
          if (sheetName.toLowerCase() === 'quote summary') {
            // Extract quote summary data
            worksheet.eachRow((row, rowNumber) => {
              if (rowNumber > 1) { // Skip header row
                const field = row.getCell(1).text.trim();
                const value = row.getCell(2).text.trim();
                
                if (field.toLowerCase() === 'total quote value' && value) {
                  sqr.totalQuoteValue = parseFloat(value);
                } else if (field.toLowerCase() === 'currency' && value) {
                  sqr.currency = value;
                } else if (field.toLowerCase() === 'comments' && value) {
                  sqr.comments = value;
                }
              }
            });
          }
        }
      }

      // Update the SQR status and lastUpdated
      sqr.status = 'draft'; // Keep as draft until explicitly submitted
      sqr.lastUpdated = new Date();

      // Save the updated SQR
      await sqr.save();

      // Clean up the temporary file
      fs.unlink(filePath, (err) => {
        if (err) {
          console.error('Error deleting temporary file:', err);
        }
      });

      return sqr;
    } catch (error) {
      console.error('Error importing SQR from Excel:', error);
      throw error;
    }
  }

  /**
   * Extract data from a worksheet based on the section structure
   * @param worksheet Excel worksheet
   * @param section SQR section
   * @returns Extracted section data
   */
  private async extractDataFromWorksheet(worksheet: ExcelJS.Worksheet, section: any): Promise<any> {
    const extractedSection: any = {
      fields: [...section.fields],
      subsections: [...section.subsections],
      tables: [...section.tables]
    };

    // Process fields
    if (section.fields && section.fields.length > 0) {
      let rowIndex = 1; // Start from row 1
      
      for (const field of section.fields) {
        if (field.editableBySupplier) {
          // Find the row with this field label
          let foundRow = false;
          worksheet.eachRow((row, rowNumber) => {
            const cellValue = row.getCell(1).text.trim();
            if (cellValue === field.label) {
              foundRow = true;
              // Update the field value
              const value = row.getCell(2).text.trim();
              const fieldIndex = extractedSection.fields.findIndex((f: any) => f.id === field.id);
              if (fieldIndex !== -1) {
                extractedSection.fields[fieldIndex].value = value;
              }
            }
          });
        }
      }
    }

    // Process subsections
    if (section.subsections && section.subsections.length > 0) {
      for (let i = 0; i < section.subsections.length; i++) {
        const subsection = section.subsections[i];
        
        // Process fields in subsection
        if (subsection.fields && subsection.fields.length > 0) {
          for (const field of subsection.fields) {
            if (field.editableBySupplier) {
              // Find the row with this field label
              worksheet.eachRow((row, rowNumber) => {
                const cellValue = row.getCell(1).text.trim();
                if (cellValue === field.label) {
                  // Update the field value
                  const value = row.getCell(2).text.trim();
                  const fieldIndex = extractedSection.subsections[i].fields.findIndex((f: any) => f.id === field.id);
                  if (fieldIndex !== -1) {
                    extractedSection.subsections[i].fields[fieldIndex].value = value;
                  }
                }
              });
            }
          }
        }

        // Process tables in subsection
        if (subsection.tables && subsection.tables.length > 0) {
          for (let j = 0; j < subsection.tables.length; j++) {
            const table = subsection.tables[j];
            
            // Find the table in the worksheet
            let tableStartRow = -1;
            let tableEndRow = -1;
            let headerRow: any[] = [];
            
            // Find the table header row
            worksheet.eachRow((row, rowNumber) => {
              const cellValue = row.getCell(1).text.trim();
              if (cellValue === table.title) {
                // The header row is typically 2 rows after the title
                tableStartRow = rowNumber + 2;
              }
            });
            
            if (tableStartRow > 0) {
              // Get the header row
              const headerRowData = worksheet.getRow(tableStartRow);
              headerRow = [];
              headerRowData.eachCell((cell, colNumber) => {
                headerRow.push(cell.text.trim());
              });
              
              // Find the end of the table (empty row or end of worksheet)
              tableEndRow = tableStartRow;
              for (let rowNum = tableStartRow + 1; rowNum <= worksheet.rowCount; rowNum++) {
                const row = worksheet.getRow(rowNum);
                let isEmpty = true;
                row.eachCell((cell) => {
                  if (cell.text.trim() !== '') {
                    isEmpty = false;
                  }
                });
                
                if (isEmpty) {
                  tableEndRow = rowNum - 1;
                  break;
                } else if (rowNum === worksheet.rowCount) {
                  tableEndRow = rowNum;
                }
              }
              
              // Extract data from the table
              const tableData: any[] = [];
              for (let rowNum = tableStartRow + 1; rowNum <= tableEndRow; rowNum++) {
                const row = worksheet.getRow(rowNum);
                const rowData: any = {};
                
                // Map column headers to values
                table.columns.forEach((column, colIndex) => {
                  if (column.editableBySupplier) {
                    const headerIndex = headerRow.findIndex(header => 
                      header.toLowerCase() === column.header.toLowerCase()
                    );
                    
                    if (headerIndex !== -1) {
                      rowData[column.accessorKey] = row.getCell(headerIndex + 1).text.trim();
                    }
                  }
                });
                
                // Add non-editable data from the original table
                if (table.data && table.data.length >= rowNum - tableStartRow - 1) {
                  const originalRowData = table.data[rowNum - tableStartRow - 1];
                  table.columns.forEach(column => {
                    if (!column.editableBySupplier && originalRowData) {
                      rowData[column.accessorKey] = originalRowData[column.accessorKey];
                    }
                  });
                }
                
                tableData.push(rowData);
              }
              
              // Update the table data
              extractedSection.subsections[i].tables[j].data = tableData;
            }
          }
        }
      }
    }

    // Process tables in the section
    if (section.tables && section.tables.length > 0) {
      for (let i = 0; i < section.tables.length; i++) {
        const table = section.tables[i];
        
        // Find the table in the worksheet
        let tableStartRow = -1;
        let tableEndRow = -1;
        let headerRow: any[] = [];
        
        // Find the table header row
        worksheet.eachRow((row, rowNumber) => {
          const cellValue = row.getCell(1).text.trim();
          if (cellValue === table.title) {
            // The header row is typically 2 rows after the title
            tableStartRow = rowNumber + 2;
          }
        });
        
        if (tableStartRow > 0) {
          // Get the header row
          const headerRowData = worksheet.getRow(tableStartRow);
          headerRow = [];
          headerRowData.eachCell((cell, colNumber) => {
            headerRow.push(cell.text.trim());
          });
          
          // Find the end of the table (empty row or end of worksheet)
          tableEndRow = tableStartRow;
          for (let rowNum = tableStartRow + 1; rowNum <= worksheet.rowCount; rowNum++) {
            const row = worksheet.getRow(rowNum);
            let isEmpty = true;
            row.eachCell((cell) => {
              if (cell.text.trim() !== '') {
                isEmpty = false;
              }
            });
            
            if (isEmpty) {
              tableEndRow = rowNum - 1;
              break;
            } else if (rowNum === worksheet.rowCount) {
              tableEndRow = rowNum;
            }
          }
          
          // Extract data from the table
          const tableData: any[] = [];
          for (let rowNum = tableStartRow + 1; rowNum <= tableEndRow; rowNum++) {
            const row = worksheet.getRow(rowNum);
            const rowData: any = {};
            
            // Map column headers to values
            table.columns.forEach((column, colIndex) => {
              if (column.editableBySupplier) {
                const headerIndex = headerRow.findIndex(header => 
                  header.toLowerCase() === column.header.toLowerCase()
                );
                
                if (headerIndex !== -1) {
                  rowData[column.accessorKey] = row.getCell(headerIndex + 1).text.trim();
                }
              }
            });
            
            // Add non-editable data from the original table
            if (table.data && table.data.length >= rowNum - tableStartRow - 1) {
              const originalRowData = table.data[rowNum - tableStartRow - 1];
              table.columns.forEach(column => {
                if (!column.editableBySupplier && originalRowData) {
                  rowData[column.accessorKey] = originalRowData[column.accessorKey];
                }
              });
            }
            
            tableData.push(rowData);
          }
          
          // Update the table data
          extractedSection.tables[i].data = tableData;
        }
      }
    }

    return extractedSection;
  }

  /**
   * Submit the SQR and update the RFQ with supplier response data
   * @param sqrId ID of the SQR to submit
   * @returns Updated SQR document
   */
  async submitSQR(sqrId: string): Promise<SQRDocument> {
    try {
      // Find the SQR
      const sqr = await SQRModel.findById(sqrId);
      if (!sqr) {
        throw new AppError(404, `SQR with ID ${sqrId} not found`);
      }

      // Update SQR status and submission date
      sqr.status = 'submitted';
      sqr.submissionDate = new Date();
      sqr.lastUpdated = new Date();

      // Save the updated SQR
      await sqr.save();

      // Update the RFQ with the supplier's response
      await this.updateRFQWithSupplierResponse(sqr);

      return sqr;
    } catch (error) {
      console.error('Error submitting SQR:', error);
      throw error;
    }
  }

  /**
   * Update the RFQ with the supplier's response data
   * @param sqr The submitted SQR document
   */
  private async updateRFQWithSupplierResponse(sqr: SQRDocument): Promise<void> {
    try {
      // Find the RFQ
      const rfq = await this.rfqService.findById(sqr.rfqId.toString());
      if (!rfq) {
        throw new AppError(404, `RFQ with ID ${sqr.rfqId} not found`);
      }

      // Find the supplier in the RFQ
      const supplierIndex = rfq.suppliers.findIndex(supplier => 
        supplier.id.toString() === sqr.supplierId.toString()
      );

      if (supplierIndex === -1) {
        throw new AppError(404, `Supplier with ID ${sqr.supplierId} not found in RFQ`);
      }

      // Update the supplier status and response data
      const updatedSuppliers = [...rfq.suppliers];
      updatedSuppliers[supplierIndex] = {
        ...updatedSuppliers[supplierIndex],
        status: 'submitted',
        submissionDate: new Date(),
        responseData: {
          totalQuoteValue: sqr.totalQuoteValue,
          currency: sqr.currency,
          comments: sqr.comments,
          sections: sqr.sections
        }
      };

      // Update the RFQ
      await this.rfqService.update(rfq._id.toString(), {
        suppliers: updatedSuppliers
      });
    } catch (error) {
      console.error('Error updating RFQ with supplier response:', error);
      throw error;
    }
  }
} 