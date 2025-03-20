import ExcelJS from 'exceljs';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { RFQDocument } from '../types/rfq';
import { FileStorageService } from './file-storage.service';
import { RFQModel } from '../models/rfq.model';

export class ExcelService {
  private fileStorageService: FileStorageService;
  
  constructor() {
    this.fileStorageService = new FileStorageService();
  }

  /**
   * Generate Excel file from RFQ template structure and store it
   * @param rfq The RFQ document
   * @param supplierId The supplier ID (optional)
   * @param templateStructure The processed template structure
   * @returns Path to the generated Excel file
   */
  async generateRFQExcel(rfq: RFQDocument, supplierId?: string | number, templateStructure?: any): Promise<string> {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'RFQ System';
    workbook.lastModifiedBy = 'RFQ System';
    workbook.created = new Date();
    workbook.modified = new Date();
    
    // Add Instructions sheet
    const instructionsSheet = workbook.addWorksheet('Instructions');
    
    // Add title with styling
    const titleRow = instructionsSheet.addRow(['How to Complete This RFQ Response']);
    titleRow.font = { bold: true, size: 14 };
    titleRow.height = 24;
    
    // Add instructions content
    instructionsSheet.addRow([]);
    instructionsSheet.addRow(['This Excel file contains the details of the Request for Quotation (RFQ).']);
    instructionsSheet.addRow(['Please follow these instructions to submit your response:']);
    instructionsSheet.addRow(['']);
    instructionsSheet.addRow(['1. Review all sheets to understand the requirements.']);
    instructionsSheet.addRow(['2. Fill in your responses in the designated editable cells.']);
    instructionsSheet.addRow(['3. Save the file with your company name in the filename.']);
    instructionsSheet.addRow(['4. Submit your response before the deadline.']);
    
    // Add Supplier sheet with details and UUID
    if (supplierId) {
      await this.addSupplierSheet(workbook, rfq, supplierId.toString());
    }
    
    // If using template structure, generate sheets based on that
    if (templateStructure) {
      await this.generateSheetsFromTemplate(workbook, templateStructure);
    } else {
      // Otherwise use the RFQ document structure
      await this.generateSheetsFromRFQ(workbook, rfq);
    }
    
    // Create a temporary file path
    console.log('os.tmpdir()', os.tmpdir())
    const tempFilePath = path.join(os.tmpdir(), `rfq-${rfq._id}-${Date.now()}.xlsx`);
    console.log('tempFilePath', tempFilePath)
    // Write to file
    await workbook.xlsx.writeFile(tempFilePath);
    
    // If supplierId is provided, store the file for later retrieval
    if (supplierId) {
      await this.storeExcelForSupplier(rfq._id.toString(), supplierId.toString(), tempFilePath);
    }
    
    return tempFilePath;
  }
  
  /**
   * Generate Excel sheets from template structure
   */
  private async generateSheetsFromTemplate(workbook: ExcelJS.Workbook, templateStructure: any): Promise<void> {
    // Check if templateStructure and sections exist
    if (!templateStructure || !templateStructure.sections || !Array.isArray(templateStructure.sections)) {
      console.warn('Template structure is missing or has no sections array');
      // Add a default sheet with a message
      const defaultSheet = workbook.addWorksheet('RFQ Details');
      defaultSheet.addRow(['No template structure available']);
      return;
    }
    
    // Process each section in the template structure
    for (const section of templateStructure.sections) {
      // Skip sections not visible to suppliers
      if (section.visibleToSupplier === false) {
        continue;
      }
      
      // Create a worksheet for each section
      const sheet = workbook.addWorksheet(section.title || 'Untitled Section');
      
      // Add section title as a header
      const titleRow = sheet.addRow([section.title || 'Untitled Section']);
      titleRow.font = { bold: true, size: 14 };
      titleRow.height = 24;
      sheet.addRow([]); // Empty row after title
      
      // Process fields in the section - create a table with two columns
      if (section.fields && Array.isArray(section.fields) && section.fields.length > 0) {
        // Add a table header for fields
        const fieldsHeaderRow = sheet.addRow(['Field', 'Value']);
        fieldsHeaderRow.font = { bold: true };
        fieldsHeaderRow.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFE0E0E0' }
        };
        
        // Style the header cells
        ['A', 'B'].forEach(col => {
          const cell = sheet.getCell(`${col}${fieldsHeaderRow.number}`);
          cell.border = {
            top: { style: 'thin' },
            left: { style: 'thin' },
            bottom: { style: 'thin' },
            right: { style: 'thin' }
          };
          
          // Enable text wrapping for headers
          cell.alignment = {
            wrapText: true,
            vertical: 'middle',
            horizontal: 'center'
          };
        });
        
        // Add field rows
        for (const field of section.fields) {
          if (!field) continue;
          
          // Skip fields not visible to suppliers
          if (field.visibleToSupplier === false) {
            continue;
          }
          
          const label = field.label || field.name || '';
          const value = field.value || field.defaultValue || '';
          
          const dataRow = sheet.addRow([label, value]);
          
          // Style the cells
          ['A', 'B'].forEach(col => {
            const cell = sheet.getCell(`${col}${dataRow.number}`);
            cell.border = {
              top: { style: 'thin' },
              left: { style: 'thin' },
              bottom: { style: 'thin' },
              right: { style: 'thin' }
            };
            
            // Enable text wrapping for data cells
            cell.alignment = {
              wrapText: true,
              vertical: 'top'
            };
          });
          
          // Make the value cell editable only if editableBySupplier is true
          const isEditable = field.editableBySupplier === true;
          if (isEditable) {
            const valueCell = dataRow.getCell(2);
            valueCell.protection = { locked: false };
            valueCell.fill = {
              type: 'pattern',
              pattern: 'solid',
              fgColor: { argb: 'FFFFD700' } // Light yellow background for editable cells
            };
          }
        }
        
        // Add an empty row after the fields table
        sheet.addRow([]);
      }
      
      // Process tables in section
      if (section.tables && Array.isArray(section.tables) && section.tables.length > 0) {
        for (const table of section.tables) {
          // Skip tables not visible to suppliers
          if (table.visibleToSupplier === false) {
            continue;
          }
          await this.processTableInSheet(sheet, table);
        }
      }
      console.log('done222222222222222222222222222')
      // Process subsections
      if (section.subsections && Array.isArray(section.subsections) && section.subsections.length > 0) {
        // First, check if any subsections have content and create a consolidated content table
        const hasSubsectionsWithContent = section.subsections.some(
          (subsection: any) => subsection.visibleToSupplier !== false && subsection.content
        );
        
        if (hasSubsectionsWithContent) {
          // Add a consolidated content table for all subsections
          this.processSectionContent(sheet, section);
        }
        
        // Now process each subsection's fields and tables
        for (const subsection of section.subsections) {
          // Skip subsections not visible to suppliers
          if (subsection.visibleToSupplier === false) {
            continue;
          }
          
          // Add subsection title
          const subsectionTitleRow = sheet.addRow([subsection.title]);
          subsectionTitleRow.font = { bold: true, size: 12 };
          subsectionTitleRow.height = 20;
          sheet.addRow([]); // Empty row after title
          
          // Process fields in subsection - create a table with two columns
          if (subsection.fields && Array.isArray(subsection.fields) && subsection.fields.length > 0) {
            // Add a table header for fields
            const fieldsHeaderRow = sheet.addRow(['Field', 'Value']);
            fieldsHeaderRow.font = { bold: true };
            fieldsHeaderRow.fill = {
              type: 'pattern',
              pattern: 'solid',
              fgColor: { argb: 'FFE0E0E0' }
            };
            
            // Style the header cells
            ['A', 'B'].forEach(col => {
              const cell = sheet.getCell(`${col}${fieldsHeaderRow.number}`);
              cell.border = {
                top: { style: 'thin' },
                left: { style: 'thin' },
                bottom: { style: 'thin' },
                right: { style: 'thin' }
              };
              
              // Enable text wrapping for headers
              cell.alignment = {
                wrapText: true,
                vertical: 'middle',
                horizontal: 'center'
              };
            });
            
            // Add field rows
            for (const field of subsection.fields) {
              if (!field) continue;
              
              // Skip fields not visible to suppliers
              if (field.visibleToSupplier === false) {
                continue;
              }
              
              const label = field.label || field.name || '';
              const value = field.value || field.defaultValue || '';
              
              const dataRow = sheet.addRow([label, value]);
              
              // Style the cells
              ['A', 'B'].forEach(col => {
                const cell = sheet.getCell(`${col}${dataRow.number}`);
                cell.border = {
                  top: { style: 'thin' },
                  left: { style: 'thin' },
                  bottom: { style: 'thin' },
                  right: { style: 'thin' }
                };
                
                // Enable text wrapping for data cells
                cell.alignment = {
                  wrapText: true,
                  vertical: 'top'
                };
              });
              
              // Make the value cell editable only if editableBySupplier is true
              const isEditable = field.editableBySupplier === true;
              if (isEditable) {
                const valueCell = dataRow.getCell(2);
                valueCell.protection = { locked: false };
                valueCell.fill = {
                  type: 'pattern',
                  pattern: 'solid',
                  fgColor: { argb: 'FFFFD700' } // Light yellow background for editable cells
                };
              }
            }
            
            // Add an empty row after the fields table
            sheet.addRow([]);
          }
          
          // Process tables in subsection
          if (subsection.tables && Array.isArray(subsection.tables) && subsection.tables.length > 0) {
            for (const table of subsection.tables) {
              // Skip tables not visible to suppliers
              if (table.visibleToSupplier === false) {
                continue;
              }
              await this.processTableInSheet(sheet, table);
            }
          }
        }
      }
      
      // Auto-size columns for better readability
      sheet.columns.forEach((column: any) => {
        if (column && column.eachCell) {
          let maxLength = 0;
          column.eachCell({ includeEmpty: true }, (cell: any) => {
            const columnLength = cell.value ? cell.value.toString().length : 10;
            if (columnLength > maxLength) {
              maxLength = columnLength;
            }
          });
          column.width = Math.min(maxLength + 2, 50); // Cap width at 50 characters
        }
      });
      
      // Enable sheet protection with exceptions for editable cells
      sheet.protect('', {
        selectLockedCells: true,
        selectUnlockedCells: true,
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
      });
    }
    console.log('done111111111111111111111111111')
  }
  
  /**
   * Process table in a sheet
   */
  private async processTableInSheet(sheet: ExcelJS.Worksheet, table: any): Promise<void> {
    if (!sheet || !table || !table.columns || !Array.isArray(table.columns) || table.columns.length === 0) {
      return;
    }
    
    try {
      // Filter columns based on visibleToSupplier flag
      const visibleColumns = table.columns.filter((col: any) => col.visibleToSupplier !== false);
      
      if (visibleColumns.length === 0) {
        console.log('No visible columns for table:', table.title || 'Untitled Table');
        return;
      }
      
      // Get column headers and keys
      const headers = visibleColumns.map((col: any) => col.header || col.name || '');
      const columnKeys = visibleColumns.map((col: any) => col.key || col.id || col.name || '');
      const editableColumns = visibleColumns.map((col: any) => col.editableBySupplier === true);
      
      // Find the options column index if it exists
      const optionsColumnIndex = visibleColumns.findIndex((col: any) => 
        col.key === 'options' || col.id === 'options' || col.name === 'options'
      );
      
      // Add column headers
      const headerRow = sheet.addRow(headers);
      if (headerRow) {
        headerRow.font = { bold: true };
        headerRow.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFE0E0E0' }
        };
        
        // Style the header cells
        for (let i = 1; i <= headers.length; i++) {
          const cell = headerRow.getCell(i);
          if (cell) {
            cell.border = {
              top: { style: 'thin' },
              left: { style: 'thin' },
              bottom: { style: 'thin' },
              right: { style: 'thin' }
            };
            
            // Enable text wrapping for headers
            cell.alignment = {
              wrapText: true,
              vertical: 'middle',
              horizontal: 'center'
            };
          }
        }
      }
      
      // Add data rows if available
      if (table.data && Array.isArray(table.data) && table.data.length > 0) {
        let rowIndex = headerRow ? headerRow.number + 1 : 1;
        
        // Get or create a hidden sheet for dropdown lists
        // Use a shorter name and make it unique with a random suffix
        const dropdownSheetName = `DD_${Math.floor(Math.random() * 10000)}`;
        let dropdownSheet: ExcelJS.Worksheet;
        
        try {
          // Try to get existing sheet
          const existingSheet = sheet.workbook.getWorksheet(dropdownSheetName);
          if (existingSheet) {
            // Use existing sheet if found
            dropdownSheet = existingSheet;
          } else {
            // Create if it doesn't exist
            dropdownSheet = sheet.workbook.addWorksheet(dropdownSheetName, {state: 'hidden'});
          }
        } catch (error) {
          console.error('Error creating dropdown sheet:', error);
          // Create with a different name if there was an error
          dropdownSheet = sheet.workbook.addWorksheet(`DD_${Date.now() % 10000}`, {state: 'hidden'});
        }
        
        let dropdownRowIndex = 1;
        
        for (const rowData of table.data) {
          if (!rowData) continue;
          
          // Extract values from the row data object using column keys
          const rowValues = columnKeys.map((key: string) => {
            // Handle nested properties using dot notation (e.g., "address.city")
            if (key && key.includes('.')) {
              const parts = key.split('.');
              let value = rowData;
              for (const part of parts) {
                if (value && typeof value === 'object') {
                  value = value[part];
                } else {
                  value = '';
                  break;
                }
              }
              return value !== undefined ? value : '';
            }
            
            // Handle regular properties
            return key && rowData[key] !== undefined ? rowData[key] : '';
          });
          
          const dataRow = sheet.addRow(rowValues);
          if (!dataRow) continue;
          
          // Get row-specific options if available
          let rowOptions: string[] | null = null;
          
          // Check if this row has options property
          if (rowData.options && Array.isArray(rowData.options)) {
            rowOptions = rowData.options.map((opt: any) => 
              typeof opt === 'object' ? (opt.label || opt.value || '') : String(opt)
            );
          }
          
          // Style the data cells and add dropdowns for select/multiselect columns
          for (let i = 0; i < visibleColumns.length; i++) {
            const column = visibleColumns[i];
            const cell = dataRow.getCell(i + 1);
            
            if (cell) {
              // Apply standard cell styling
              cell.border = {
                top: { style: 'thin' },
                left: { style: 'thin' },
                bottom: { style: 'thin' },
                right: { style: 'thin' }
              };
              
              // Enable text wrapping for data cells
              cell.alignment = {
                wrapText: true,
                vertical: 'top'
              };
              
              // Make cell editable if the column is editable
              if (editableColumns[i]) {
                cell.protection = { locked: false };
                cell.fill = {
                  type: 'pattern',
                  pattern: 'solid',
                  fgColor: { argb: 'FFFFD700' } // Light yellow background for editable cells
                };
                
                // Check if this is a response column and we have options
                if (column.id === 'response' && rowOptions && rowOptions.length > 0 && 
                    (rowData['type'] === 'single-select' || rowData['type'] === 'multi-select')) {
                  // Determine which options to use
                  let options: string[] | null = null;
                  
                  // First priority: Use row-specific options if available
                  if (rowOptions) {
                    options = rowOptions;
                  }
                  // Second priority: Use options from the options column in this row if it exists
                  else if (optionsColumnIndex >= 0) {
                    const optionsValue = rowValues[optionsColumnIndex];
                    if (optionsValue) {
                      // Parse options from the options column
                      // Options might be comma-separated string or JSON string
                      try {
                        if (optionsValue.startsWith('[') && optionsValue.endsWith(']')) {
                          // Try to parse as JSON
                          const parsedOptions = JSON.parse(optionsValue);
                          if (Array.isArray(parsedOptions)) {
                            options = parsedOptions.map((opt: any) => 
                              typeof opt === 'object' ? (opt.label || opt.value || '') : String(opt)
                            );
                          }
                        } else {
                          // Assume comma-separated string
                          options = optionsValue.split(',').map((o: string) => o.trim());
                        }
                      } catch (e) {
                        console.error('Error parsing options:', e);
                        // Fallback to comma-separated string
                        options = optionsValue.split(',').map((o: string) => o.trim());
                      }
                    }
                  }
                  // Third priority: Use options from column definition
                  else if (column.options && Array.isArray(column.options)) {
                    options = column.options.map((opt: any) => 
                      typeof opt === 'object' ? (opt.label || opt.value || '') : String(opt)
                    );
                  }
                  
                  console.log({options});
                  // If we have options, add a dropdown using Excel's data validation
                  if (options && options.length > 0) {
                    try {
                      // Instead of using named ranges (which can cause issues), 
                      // use direct cell references or a comma-separated list
                      
                      // Method 1: Use a direct comma-separated list in the formula
                      const validation: ExcelJS.DataValidation = {
                        type: 'list' as const,
                        allowBlank: true,
                        formulae: [`"${options.join(',')}"`], // Put options directly in quotes
                        showErrorMessage: true,
                        errorStyle: 'error' as const,
                        error: 'Please select a value from the list',
                        errorTitle: 'Invalid Selection',
                        showInputMessage: true,
                        promptTitle: 'Select an option',
                        prompt: 'Please select from the dropdown list'
                      };
                      
                      // Apply validation to the cell
                      cell.dataValidation = validation;
                      
                      console.log(`Added dropdown to cell ${cell.address} with options: ${options.join(',')}`);
                    } catch (error) {
                      console.error('Error adding data validation:', error);
                      
                      // Fallback to adding a comment with options
                      cell.note = `Valid options: ${options.join(', ')}`;
                    }
                  }
                }
              }
            }
          }
          
          rowIndex++;
        }
      } else {
        console.log('No data found for table:', table.title || 'Untitled Table');
      }
      
      // Add empty rows for user input if specified
      if (table.emptyRows && typeof table.emptyRows === 'number' && table.emptyRows > 0) {
        let rowIndex = headerRow ? headerRow.number + (table.data?.length || 0) + 1 : 1;
        
        for (let i = 0; i < table.emptyRows; i++) {
          const emptyValues = Array(headers.length).fill('');
          const emptyRow = sheet.addRow(emptyValues);
          if (!emptyRow) continue;
          
          // Style the empty cells and add dropdowns for select/multiselect columns
          for (let j = 0; j < visibleColumns.length; j++) {
            const column = visibleColumns[j];
            const cell = emptyRow.getCell(j + 1);
            
            if (cell) {
              // Apply standard cell styling
              cell.border = {
                top: { style: 'thin' },
                left: { style: 'thin' },
                bottom: { style: 'thin' },
                right: { style: 'thin' }
              };
              
              // Enable text wrapping for empty cells
              cell.alignment = {
                wrapText: true,
                vertical: 'top'
              };
              
              // Make cell editable if the column is editable
              if (editableColumns[j]) {
                cell.protection = { locked: false };
                cell.fill = {
                  type: 'pattern',
                  pattern: 'solid',
                  fgColor: { argb: 'FFFFD700' } // Light yellow background for editable cells
                };
                
                // Check if this column has type select/multiselect
                if ((column.type === 'select' || column.type === 'multiselect')) {
                  // Get options from the column definition
                  let options = column.options;
                  
                  // If options is an array of objects, extract the labels or values
                  if (Array.isArray(options) && options.length > 0 && typeof options[0] === 'object') {
                    options = options.map((opt: any) => opt.label || opt.value || '');
                  }
                  
                  // If we have options, add a dropdown
                  if (Array.isArray(options) && options.length > 0) {
                    try {
                      // Get the cell reference
                      const cellRef = cell.address;
                      
                      // Add a comment with dropdown options as a workaround
                      cell.note = `Valid options: ${options.join(', ')}`;
                      
                      // Set a custom property to indicate this should be a dropdown
                      (cell as any).dropdownOptions = options;
                      
                      console.log(`Added dropdown options to cell ${cellRef}: ${options.join(',')}`);
                    } catch (error) {
                      console.error('Error adding data validation:', error);
                    }
                  }
                }
              }
            }
          }
          
          rowIndex++;
        }
      }
      
      // Add an empty row after the table
      sheet.addRow([]);
    } catch (error) {
      console.error('Error processing table in sheet:', error);
      // Continue execution despite errors
    }
  }
  
  /**
   * Generate Excel sheets from RFQ document
   */
  private async generateSheetsFromRFQ(workbook: ExcelJS.Workbook, rfq: RFQDocument): Promise<void> {
    // Create General Details sheet
    const generalSheet = workbook.addWorksheet('General Details');
    generalSheet.columns = [
      { header: 'Field', key: 'field', width: 30 },
      { header: 'Value', key: 'value', width: 50 }
    ];
    
    // Enable text wrapping for all cells in the sheet
    generalSheet.eachRow((row, rowNumber) => {
      row.eachCell((cell) => {
        cell.alignment = {
          wrapText: true,
          vertical: 'top'
        };
      });
    });
    
    // Add basic RFQ details
    generalSheet.addRow({ field: 'Title', value: rfq.title || '' });
    generalSheet.addRow({ field: 'Description', value: rfq.description || '' });
    generalSheet.addRow({ field: 'Status', value: rfq.status || '' });
    generalSheet.addRow({ field: 'Due Date', value: rfq.dueDate || '' });
    
    // Process Scope of Work if available
    if (rfq.scopeOfWork) {
      const sowSheet = workbook.addWorksheet('Scope of Work');
      sowSheet.columns = [
        { header: 'Section', key: 'section', width: 30 },
        { header: 'Content', key: 'content', width: 70 }
      ];
      
      // Enable text wrapping for all cells in the sheet
      sowSheet.eachRow((row, rowNumber) => {
        row.eachCell((cell) => {
          cell.alignment = {
            wrapText: true,
            vertical: 'top'
          };
        });
      });
      
      // Add scope of work content
      if (typeof rfq.scopeOfWork === 'string') {
        sowSheet.addRow({ section: 'Scope of Work', content: rfq.scopeOfWork });
      } else if (typeof rfq.scopeOfWork === 'object') {
        // Handle structured scope of work
        Object.entries(rfq.scopeOfWork).forEach(([key, value]) => {
          if (typeof value === 'string') {
            sowSheet.addRow({ section: this.formatKey(key), content: value });
          } else if (Array.isArray(value)) {
            sowSheet.addRow({ section: this.formatKey(key), content: value.join(', ') });
          }
        });
      }
    }
    
    // Process Questionnaire if available
    if (rfq.questionnaire && Array.isArray(rfq.questionnaire)) {
      await this.addQuestionnaireSheet(workbook, rfq);
    }
    
    // Process Items/Commercial Table if available
    if (rfq.items && Array.isArray(rfq.items)) {
      const itemsSheet = workbook.addWorksheet('Items');
      
      // Determine columns from the first item
      if (rfq.items.length > 0) {
        const firstItem = rfq.items[0];
        const columns = Object.keys(firstItem).map(key => ({
          header: this.formatKey(key),
          key: key,
          width: 20
        }));
        
        itemsSheet.columns = columns;
        
        // Add items data
        rfq.items.forEach(item => {
          itemsSheet.addRow(item);
        });
      }
    }
  }
  
  /**
   * Format a key string to be more readable
   * e.g., "itemName" -> "Item Name"
   */
  private formatKey(key: string): string {
    return key
      .replace(/([A-Z])/g, ' $1') // Insert space before capital letters
      .replace(/^./, str => str.toUpperCase()) // Capitalize first letter
      .trim();
  }
  
  /**
   * Store Excel file for a supplier
   */
  private async storeExcelForSupplier(rfqId: string, supplierId: string, filePath: string): Promise<string> {
    try {
      // Generate a UUID for this Excel file
      const uuid = this.generateUUID();
      
      // Create a category name for the file storage
      const category = `excel/rfq-${rfqId}`;
      
      // Store the file with the UUID as the filename
      const storedFile = this.fileStorageService.storeFile(
        filePath, 
        category, 
        `${uuid}.xlsx`
      );
      
      // Store the UUID in the RFQ document
      await this.storeSupplierUUID(rfqId, supplierId, uuid);
      
      return uuid;
    } catch (error) {
      console.error('Error storing Excel file for supplier:', error);
      throw error;
    }
  }

  /**
   * Get the Excel file for a supplier
   */
  async getSupplierExcelFile(rfqId: string, supplierId: string): Promise<string> {
    try {
      // Find the RFQ
      const rfq = await RFQModel.findById(rfqId);
      if (!rfq) {
        throw new Error(`RFQ with ID ${rfqId} not found`);
      }
      
      // Find the supplier
      if (!rfq.suppliers || !Array.isArray(rfq.suppliers)) {
        throw new Error(`No suppliers found for RFQ ${rfqId}`);
      }
      
      const supplier = rfq.suppliers.find(s => s.id.toString() === supplierId);
      if (!supplier) {
        throw new Error(`Supplier with ID ${supplierId} not found in RFQ ${rfqId}`);
      }
      
      // Check if we need to generate a new Excel file
      // We'll use the excelUUID property to check if an Excel file was generated
      if (!supplier.excelUUID) {
        // If no stored file exists, generate a new one
        return this.generateRFQExcel(rfq, supplierId);
      }
      
      // Try to find the file in storage using a consistent naming pattern
      const fileName = `rfq-${rfqId}-supplier-${supplierId}.xlsx`;
      
      try {
        // Get the file path from storage
        return this.fileStorageService.getFilePath(fileName, 'excel');
      } catch (fileError) {
        console.error('Error retrieving stored Excel file, generating a new one:', fileError);
        // If the file doesn't exist or can't be accessed, generate a new one
        return this.generateRFQExcel(rfq, supplierId);
      }
    } catch (error) {
      console.error('Error getting supplier Excel file:', error);
      throw error;
    }
  }

  /**
   * Add questionnaire data to the Excel workbook
   */
  private addQuestionnaireSheet(workbook: ExcelJS.Workbook, rfq: RFQDocument): void {
    if (!rfq.questionnaire || !Array.isArray(rfq.questionnaire) || rfq.questionnaire.length === 0) {
      return;
    }
    
    // Create questionnaire sheet
    const questionnaireSheet = workbook.addWorksheet('Questionnaire');
    
    // Add columns
    questionnaireSheet.columns = [
      { header: 'Section', key: 'section', width: 20 },
      { header: 'Question', key: 'question', width: 40 },
      { header: 'Type', key: 'type', width: 15 },
      { header: 'Options', key: 'options', width: 30 },
      { header: 'Response', key: 'response', width: 30 },
      { header: 'Remarks', key: 'remarks', width: 30 }
    ];
    
    // Add data
    rfq.questionnaire.forEach(section => {
      if (section.title && section.data && Array.isArray(section.data)) {
        section.data.forEach((item: any) => {
          const options = item.options ? (Array.isArray(item.options) ? item.options.join(', ') : item.options) : '';
          
          questionnaireSheet.addRow({
            section: section.title,
            question: item.question,
            type: item.type,
            options: options,
            response: '',
            remarks: ''
          });
        });
      }
    });
    
    // Style the header row
    const headerRow = questionnaireSheet.getRow(1);
    headerRow.font = { bold: true };
    headerRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE0E0E0' }
    };
    
    // Enable text wrapping for all cells in the sheet
    questionnaireSheet.eachRow((row, rowNumber) => {
      row.eachCell((cell) => {
        cell.alignment = {
          wrapText: true,
          vertical: 'top'
        };
      });
    });
  }

  /**
   * Process section content in a consolidated table format
   */
  private processSectionContent(sheet: ExcelJS.Worksheet, section: any): void {
    // Skip if no subsections
    if (!section.subsections || !Array.isArray(section.subsections) || section.subsections.length === 0) {
      return;
    }
    
    // Filter visible subsections with content
    const visibleSubsections = section.subsections.filter((subsection: any) => 
      subsection.visibleToSupplier !== false && subsection.content
    );
    
    if (visibleSubsections.length === 0) {
      return;
    }
    
    try {
      // Add a table with heading and description columns
      const contentHeaderRow = sheet.addRow(['Heading', 'Description']);
      contentHeaderRow.font = { bold: true };
      contentHeaderRow.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFE0E0E0' }
      };
      
      // Style the header cells
      ['A', 'B'].forEach(col => {
        const cell = sheet.getCell(`${col}${contentHeaderRow.number}`);
        cell.border = {
          top: { style: 'thin' },
          left: { style: 'thin' },
          bottom: { style: 'thin' },
          right: { style: 'thin' }
        };
        
        // Enable text wrapping for headers
        cell.alignment = {
          wrapText: true,
          vertical: 'middle',
          horizontal: 'center'
        };
      });
      
      // Add content rows for each subsection
      for (const subsection of visibleSubsections) {
        const plainContent = subsection.content.replace(/<br>/g, '\n').replace(/<[^>]*>/g, '');
        const contentRow = sheet.addRow([subsection.title || 'Details', plainContent]);
        
        // Style the content cells
        ['A', 'B'].forEach(col => {
          const cell = sheet.getCell(`${col}${contentRow.number}`);
          cell.border = {
            top: { style: 'thin' },
            left: { style: 'thin' },
            bottom: { style: 'thin' },
            right: { style: 'thin' }
          };
          
          // Enable text wrapping for content
          cell.alignment = {
            wrapText: true,
            vertical: 'top'
          };
        });
        
        // Set appropriate row height for content
        contentRow.height = 60;
      }
      
      // Add an empty row after the content table
      sheet.addRow([]);
      
      // Set column widths
      sheet.getColumn('A').width = 30;
      sheet.getColumn('B').width = 70;
    } catch (error) {
      console.error('Error processing section content:', error);
    }
  }

  /**
   * Extract data from an Excel file buffer and update the RFQ structure with supplier responses
   */
  async extractDataFromExcelBuffer(fileBuffer: Buffer, rfq: RFQDocument, supplierId: string): Promise<any> {
    try {
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(fileBuffer);
      
      // Verify the UUID from the Supplier sheet
      const verified = await this.verifySupplierUUID(workbook, rfq._id.toString(), supplierId);
      if (!verified) {
        throw new Error('Invalid or mismatched verification UUID. This Excel file may have been tampered with or is not the original file sent to this supplier.');
      }
      
      // Get the original processed structure from the RFQ
      let processedStructure = null;
      if (rfq.template && rfq.template.processedStructure) {
        processedStructure = JSON.parse(JSON.stringify(rfq.template.processedStructure));
      } else {
        throw new Error('No processed structure found in the RFQ document');
      }
      
      // Process each section in the structure
      if (processedStructure && processedStructure.sections) {
        for (const section of processedStructure.sections) {
          // Skip sections not visible to suppliers
          if (section.visibleToSupplier === false) {
            continue;
          }
          
          // Find the corresponding worksheet
          const worksheet = workbook.getWorksheet(section.title);
          if (!worksheet) {
            console.warn(`Worksheet for section "${section.title}" not found`);
            continue;
          }
          
          // Process fields in the section
          if (section.fields && Array.isArray(section.fields)) {
            this.processFields(section.fields, worksheet);
          }
          
          // Process tables in the section
          if (section.tables && Array.isArray(section.tables)) {
            this.processTables(section.tables, worksheet);
          }
          
          // Process subsections in the section
          if (section.subsections && Array.isArray(section.subsections)) {
            for (const subsection of section.subsections) {
              // Skip subsections not visible to suppliers
              if (subsection.visibleToSupplier === false) {
                continue;
              }
              
              // Process fields in the subsection
              if (subsection.fields && Array.isArray(subsection.fields)) {
                this.processFields(subsection.fields, worksheet);
              }
              
              // Process tables in the subsection
              if (subsection.tables && Array.isArray(subsection.tables)) {
                this.processTables(subsection.tables, worksheet, subsection.title);
              }
            }
          }
        }
        
        // Process questionnaire if it exists
        this.processQuestionnaire(processedStructure, workbook);
      }
      
      // Add metadata to the response
      processedStructure.metadata = {
        rfqId: rfq._id.toString(),
        supplierId: supplierId,
        submittedAt: new Date()
      };
      
      return processedStructure;
    } catch (error) {
      console.error('Error extracting data from Excel buffer:', error);
      throw error;
    }
  }

  /**
   * Process fields and update their values from the Excel worksheet
   */
  private processFields(fields: any[], worksheet: ExcelJS.Worksheet): void {
    for (const field of fields) {
      // Skip fields not visible or editable by suppliers
      if (field.visibleToSupplier === false || field.editableBySupplier === false) {
        continue;
      }
      
      // Find the field in the Excel worksheet
      let fieldValue = null;
      const fieldLabel = field.label;
      
      // Search for the field in the worksheet
      worksheet.eachRow((row, rowNumber) => {
        const firstCell = row.getCell(1).value;
        if (firstCell === fieldLabel) {
          // Get the value from the second cell (Value column)
          fieldValue = row.getCell(2).value;
          
          // Check if the cell has a yellow background (editable)
          const valueCell = row.getCell(2);
          const isEditable = valueCell.fill && 
                            valueCell.fill.type === 'pattern' && 
                            valueCell.fill.pattern === 'solid' && 
                            valueCell.fill.fgColor && 
                            valueCell.fill.fgColor.argb === 'FFFFD700';
          
          if (isEditable) {
            // Update the field value
            field.value = this.formatCellValue(fieldValue);
          }
        }
      });
    }
  }

  /**
   * Process tables in a section or subsection
   * @param tables Array of table definitions
   * @param worksheet Excel worksheet
   * @param parentTitle Optional parent subsection title
   */
  private processTables(tables: any[], worksheet: ExcelJS.Worksheet, parentTitle?: string): void {
    if (!tables || !Array.isArray(tables)) {
      return;
    }
    
    for (const table of tables) {
      try {
        if (!table.title) {
          console.warn('Table without title found, skipping');
          continue;
        }
        
        // Skip tables not visible to suppliers
        if (table.visibleToSupplier === false) {
          continue;
        }
        
        // If this is a table within a subsection, use the specialized extraction function
        if (parentTitle) {
          table.data = this.extractSubsectionTableData(table, worksheet, parentTitle);
        } else {
          // Use the regular table extraction logic for top-level tables
          // Find the table in the Excel worksheet
          let tableFound = false;
          let headerRowNumber = 0;
          let headerCells: string[] = [];
          let editableColumns: { [key: string]: number } = {};
          
          // Find the table header row
          worksheet.eachRow((row, rowNumber) => {
            if (tableFound) return; // Skip if table already found
            
            // Check if this row contains the table headers
            const rowValues: any[] = [];
            row.eachCell((cell, colNumber) => {
              rowValues[colNumber - 1] = cell.value;
            });
            
            // Check if this row matches the table columns
            const headerMatch = table.columns.some((col: any) => 
              rowValues.includes(col.header) || rowValues.includes(col.accessorKey)
            );
            
            if (headerMatch) {
              tableFound = true;
              headerRowNumber = rowNumber;
              headerCells = rowValues.filter(v => v !== null && v !== undefined);
              
              // Map column headers to their positions
              rowValues.forEach((header, index) => {
                // Find the corresponding column in the table definition
                const column = table.columns.find((col: any) => 
                  col.header === header || col.accessorKey === header
                );
                
                if (column && column.editableBySupplier === true) {
                  editableColumns[column.id || column.accessorKey] = index;
                }
              });
            }
          });
          
          // If table header found, process the data rows
          if (tableFound && headerRowNumber > 0) {
            // Process each data row
            let currentRowIndex = 0;
            
            worksheet.eachRow((row, rowNumber) => {
              // Skip header row and rows before it
              if (rowNumber <= headerRowNumber) return;
              
              // Skip empty rows
              if (this.isEmptyRow(row)) return;
              
              // Get values from the row
              const rowValues: any[] = [];
              row.eachCell((cell, colNumber) => {
                rowValues[colNumber - 1] = cell.value;
              });
              
              // Check if we have data for this row index
              if (table.data && Array.isArray(table.data) && currentRowIndex < table.data.length) {
                const dataRow = table.data[currentRowIndex];
                
                // Update editable columns with values from Excel
                for (const [columnId, columnIndex] of Object.entries(editableColumns)) {
                  if (columnIndex < rowValues.length) {
                    const value = this.formatCellValue(rowValues[columnIndex]);
                    
                    // Update the value in the data row
                    dataRow[columnId] = value;
                  }
                }
                
                currentRowIndex++;
              }
            });
          }
        }
      } catch (error) {
        console.error(`Error processing table "${table.title}":`, error);
      }
    }
  }

  /**
   * Process questionnaire sections and update responses from the Excel workbook
   */
  private processQuestionnaire(processedStructure: any, workbook: ExcelJS.Workbook): void {
    // Check if questionnaire exists in the structure
    if (!processedStructure.questionnaire) return;
    
    // Find the Questionnaire worksheet
    const questionnaireSheet = workbook.getWorksheet('Questionnaire');
    if (!questionnaireSheet) {
      console.warn('Questionnaire worksheet not found');
      return;
    }
    
    // Process each question in the questionnaire
    let currentQuestion: any = null;
    let inQuestionSection = false;
    let questionSectionTitle = '';
    
    questionnaireSheet.eachRow((row, rowNumber) => {
      // Get values from the row
      const rowValues: any[] = [];
      row.eachCell((cell, colNumber) => {
        rowValues[colNumber - 1] = cell.value;
      });
      
      // Check if this is a section title row
      if (rowValues[0] && typeof rowValues[0] === 'string' && 
          row.getCell(1).font && row.getCell(1).font.bold) {
        inQuestionSection = true;
        questionSectionTitle = rowValues[0];
        return;
      }
      
      // Check if this is a question row
      if (inQuestionSection && rowValues[0] && rowValues[1]) {
        const questionText = rowValues[0];
        const responseValue = rowValues[1];
        const remarksValue = rowValues[2] || '';
        
        // Find the corresponding section in the questionnaire
        const section = processedStructure.sections.find((s: any) => 
          s.id === 'questionnaire' || s.accessorKey === 'questionnaire'
        );
        
        if (section && section.subsections) {
          // Find the specific questionnaire subsection
          const subsection = section.subsections.find((sub: any) => 
            sub.title === questionSectionTitle || 
            sub.id === questionSectionTitle.toLowerCase().replace(/\s+/g, '')
          );
          
          if (subsection && subsection.tables && subsection.tables.length > 0) {
            const table = subsection.tables[0];
            
            // Find the question in the table data
            if (table.data && Array.isArray(table.data)) {
              const question = table.data.find((q: any) => q.question === questionText);
              
              if (question) {
                // Update the question response and remarks
                question.value = this.formatCellValue(responseValue);
                question.response = this.formatCellValue(responseValue);
                
                if (remarksValue) {
                  question.remarks = this.formatCellValue(remarksValue);
                }
              }
            }
          }
        }
      }
    });
  }

  /**
   * Format cell value based on its type
   */
  private formatCellValue(value: any): any {
    if (value === null || value === undefined) {
      return '';
    }
    
    if (typeof value === 'object' && value.text) {
      return value.text;
    }
    
    if (typeof value === 'object' && value.result) {
      return value.result;
    }
    
    return value.toString();
  }

  /**
   * Verify the UUID from the supplier's Excel file
   */
  private async verifySupplierUUID(workbook: ExcelJS.Workbook, rfqId: string, supplierId: string): Promise<boolean> {
    try {
      // Get the Supplier sheet
      const supplierSheet = workbook.getWorksheet('Supplier');
      if (!supplierSheet) {
        console.error('Supplier sheet not found in the Excel file');
        return false;
      }
      
      // Find the UUID in the sheet
      let uploadedUUID: string | null = null;
      
      supplierSheet.eachRow((row, rowNumber) => {
        const firstCell = row.getCell(1).value;
        if (firstCell === 'Verification UUID') {
          uploadedUUID = row.getCell(2).value as string;
        }
      });
      
      if (!uploadedUUID) {
        console.error('Verification UUID not found in the Supplier sheet');
        return false;
      }
      
      // Get the RFQ document
      const rfq = await RFQModel.findById(rfqId);
      if (!rfq) {
        console.error(`RFQ not found: RFQ ID ${rfqId}`);
        return false;
      }
      
      // Check if suppliers array exists
      if (!rfq.suppliers || !Array.isArray(rfq.suppliers)) {
        console.error(`No suppliers found for RFQ ID ${rfqId}`);
        return false;
      }
      
      // Find the specific supplier by ID
      const supplier = rfq.suppliers.find(s => s.id.toString() === supplierId);
      if (!supplier) {
        console.error(`Supplier with ID ${supplierId} not found in RFQ ${rfqId}`);
        return false;
      }
      
      // Get the stored UUID for this specific supplier
      const storedUUID = supplier.excelUUID;
      
      if (!storedUUID) {
        console.error(`No stored UUID found for supplier ${supplierId}`);
        return false;
      }
      
      // Compare the UUIDs
      const isValid = uploadedUUID === storedUUID;
      
      if (!isValid) {
        console.error(`UUID mismatch for supplier ${supplierId}: Uploaded ${uploadedUUID}, Stored ${storedUUID}`);
      } else {
        console.log(`UUID verification successful for supplier ${supplierId}`);
      }
      
      return isValid;
    } catch (error) {
      console.error('Error verifying supplier UUID:', error);
      return false;
    }
  }

  /**
   * Check if a row is empty
   */
  private isEmptyRow(row: ExcelJS.Row): boolean {
    let isEmpty = true;
    row.eachCell((cell) => {
      if (cell.value !== null && cell.value !== undefined && cell.value !== '') {
        isEmpty = false;
      }
    });
    return isEmpty;
  }

  /**
   * Add supplier sheet with details and UUID for verification
   */
  private async addSupplierSheet(workbook: ExcelJS.Workbook, rfq: RFQDocument, supplierId: string): Promise<void> {
    try {
      // Create supplier sheet
      const supplierSheet = workbook.addWorksheet('Supplier');
      
      // Add title with styling
      const titleRow = supplierSheet.addRow(['Supplier Information']);
      titleRow.font = { bold: true, size: 14 };
      titleRow.height = 24;
      supplierSheet.addRow([]);
      
      // Check if suppliers array exists
      if (!rfq.suppliers || !Array.isArray(rfq.suppliers)) {
        console.warn(`No suppliers found in RFQ ${rfq._id}`);
        
        // Add a message to the sheet
        const messageRow = supplierSheet.addRow(['No supplier information available']);
        messageRow.font = { italic: true };
        
        return;
      }
      
      // Find the supplier in the RFQ
      const supplier = rfq.suppliers.find(s => s.id.toString() === supplierId);
      
      if (!supplier) {
        console.warn(`Supplier with ID ${supplierId} not found in RFQ ${rfq._id}`);
        
        // Add a message to the sheet
        const messageRow = supplierSheet.addRow(['Supplier not found in this RFQ']);
        messageRow.font = { italic: true };
        
        return;
      }
      
      // Generate a UUID for this specific Excel file
      const uuid = this.generateUUID();
      
      // Store the UUID in the database for later verification
      await this.storeSupplierUUID(rfq._id.toString(), supplierId, uuid);
      
      // Add a table header for fields
      const fieldsHeaderRow = supplierSheet.addRow(['Field', 'Value']);
      fieldsHeaderRow.font = { bold: true };
      fieldsHeaderRow.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFE0E0E0' }
      };
      
      // Style the header cells
      ['A', 'B'].forEach(col => {
        const cell = supplierSheet.getCell(`${col}${fieldsHeaderRow.number}`);
        cell.border = {
          top: { style: 'thin' },
          left: { style: 'thin' },
          bottom: { style: 'thin' },
          right: { style: 'thin' }
        };
        
        // Enable text wrapping for headers
        cell.alignment = {
          wrapText: true,
          vertical: 'middle',
          horizontal: 'center'
        };
      });
      
      // Add supplier details
      const supplierDetails = [
        { field: 'Supplier ID', value: supplier.id.toString() },
        { field: 'Name', value: supplier.name || 'N/A' },
        { field: 'Email', value: supplier.email || 'N/A' },
        { field: 'Phone', value: supplier.phone || 'N/A' },
        { field: 'Address', value: supplier.address || 'N/A' },
        { field: 'Contact Person', value: supplier.contactPerson || 'N/A' },
        { field: 'RFQ ID', value: rfq._id.toString() },
        { field: 'RFQ Title', value: rfq.title || 'N/A' },
        { field: 'RFQ Due Date', value: rfq.dueDate ? new Date(rfq.dueDate).toLocaleDateString() : 'N/A' },
        { field: 'Verification UUID', value: uuid }
      ];
      
      // Add rows for each detail
      for (const detail of supplierDetails) {
        const dataRow = supplierSheet.addRow([detail.field, detail.value]);
        
        // Style the cells
        ['A', 'B'].forEach(col => {
          const cell = supplierSheet.getCell(`${col}${dataRow.number}`);
          cell.border = {
            top: { style: 'thin' },
            left: { style: 'thin' },
            bottom: { style: 'thin' },
            right: { style: 'thin' }
          };
          
          // Enable text wrapping for data cells
          cell.alignment = {
            wrapText: true,
            vertical: 'top'
          };
        });
      }
      
      // Set column widths
      supplierSheet.getColumn('A').width = 30;
      supplierSheet.getColumn('B').width = 50;
      
      // Protect the sheet to prevent editing
      supplierSheet.protect('', {
        selectLockedCells: true,
        selectUnlockedCells: true,
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
      });
      
      console.log(`Added supplier sheet with UUID ${uuid} for supplier ${supplierId}`);
    } catch (error) {
      console.error('Error adding supplier sheet:', error);
      // Continue execution despite errors
    }
  }

  /**
   * Generate a UUID
   */
  private generateUUID(): string {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }

  /**
   * Store the UUID for a supplier's Excel file
   */
  private async storeSupplierUUID(rfqId: string, supplierId: string, uuid: string): Promise<void> {
    try {
      // First, get the RFQ document
      const rfq = await RFQModel.findById(rfqId);
      if (!rfq || !rfq.suppliers) {
        console.error(`RFQ not found or has no suppliers: ${rfqId}`);
        return;
      }
      console.log(rfq.suppliers, 'rfq.suppliers before')
      // Find the supplier and update it
      const supplierIndex = rfq.suppliers.findIndex(s => s.id.toString() === supplierId);
      console.log({supplierIndex})
      if (supplierIndex === -1) {
        console.error(`Supplier not found in RFQ: ${supplierId}`);
        return;
      }
      console.log(rfq.suppliers[supplierIndex], 'rfq.suppliers[supplierIndex]')
      // Update the supplier directly
      // rfq.suppliers[supplierIndex] = {
      //   ...rfq.suppliers[supplierIndex],
      //   excelUUID: uuid,
      //   excelGeneratedAt: new Date()
      // };
      rfq.suppliers[supplierIndex].excelUUID = uuid;
      rfq.suppliers[supplierIndex].excelGeneratedAt = new Date();
      console.log(rfq.suppliers[supplierIndex], 'rfq.suppliers[supplierIndex] after')
      console.log(rfq.suppliers, 'rfq.suppliers after')
      // Save the updated RFQ
      await rfq.save();
      
      console.log(`Stored UUID ${uuid} for supplier ${supplierId}`);
    } catch (error) {
      console.error('Error storing supplier UUID:', error);
      throw error;
    }
  }

  /**
   * Extract data from a table within a subsection
   * @param table The table definition
   * @param worksheet The Excel worksheet
   * @param subsectionTitle The title of the subsection containing the table
   * @returns The extracted table data
   */
  private extractSubsectionTableData(table: any, worksheet: ExcelJS.Worksheet, subsectionTitle: string): any[] {
    try {
      const tableData: any[] = [];
      let tableStartRow = -1;
      let tableEndRow = -1;
      let headerRow: string[] = [];
      
      // First, find the subsection title in the worksheet
      let subsectionRowIndex = -1;
      let tableRowIndex = -1;
      worksheet.eachRow((row, rowIndex) => {
        const firstCell = row.getCell(1).text.trim();
        if (firstCell === subsectionTitle) {
          subsectionRowIndex = rowIndex;
          tableRowIndex = rowIndex;
        }
      });

      console.log({subsectionRowIndex});
      
      if (subsectionRowIndex === -1) {
        console.log(subsectionRowIndex === -1, {subsectionRowIndex})
        console.warn(`Subsection "${subsectionTitle}" not found in worksheet`);
        return [];
      }
      
      // Now find the table title after the subsection title
      // for (let i = subsectionRowIndex + 1; i <= worksheet.rowCount; i++) {
      //   const row = worksheet.getRow(i);
      //   const firstCell = row.getCell(1).text.trim();
      //   if (firstCell === table.title) {
      //     tableRowIndex = i;
      //     break;
      //   }
      // }
      
      // if (tableRowIndex === -1) {
      //   console.warn(`Table "${table.title}" not found in subsection "${subsectionTitle}"`);
      //   return [];
      // }
      
      // Find the header row (should be right after the table title)
      const headerRowIndex = tableRowIndex + 2;
      if (headerRowIndex <= worksheet.rowCount) {
        const row = worksheet.getRow(headerRowIndex);
        console.log({row})
        headerRow = [];
        
        // Extract header values
        row.eachCell((cell, colIndex) => {
          headerRow.push(cell.text.trim());
        });
        
        tableStartRow = headerRowIndex + 1;
      } else {
        console.warn(`No header row found for table "${table.title}"`);
        return [];
      }
      
      // Find the end of the table (empty row or next subsection/table title)
      for (let i = tableStartRow; i <= worksheet.rowCount; i++) {
        const row = worksheet.getRow(i);
        let isEmpty = true;
        
        // Check if row is empty
        row.eachCell((cell) => {
          if (cell.text.trim() !== '') {
            isEmpty = false;
          }
        });
        
        // Check if this is the start of another section/table
        const firstCell = row.getCell(1).text.trim();
        if (isEmpty || firstCell.endsWith(':') || firstCell.startsWith('Section:')) {
          tableEndRow = i - 1;
          break;
        }
        
        // If we reached the end of the worksheet
        if (i === worksheet.rowCount) {
          tableEndRow = i;
        }
      }
      
      // Extract data rows
      for (let rowIndex = tableStartRow; rowIndex <= tableEndRow; rowIndex++) {
        const row = worksheet.getRow(rowIndex);
        let rowData: any = {};
        
        // Skip empty rows
        let hasData = false;
        row.eachCell((cell) => {
          if (cell.text.trim() !== '') {
            hasData = true;
          }
        });
        
        if (!hasData) continue;

        if (table.data && table.data.length >= rowIndex - tableStartRow) {
          const originalRowData = table.data[rowIndex - tableStartRow];
          rowData = {...originalRowData};
          console.log({originalRowData}, 2222222222)
          if (originalRowData) {
            table.columns.forEach((column: any) => {
              if (!column.editableBySupplier) {
                rowData[column.accessorKey] = originalRowData[column.accessorKey];
              }
              console.log({rowData})
            });
          }
        }
        
        // Map column headers to values
        table.columns.forEach((column: any, colIndex: number) => {
          if (column.editableBySupplier) {
            const headerIndex = headerRow.findIndex(header => 
              header.toLowerCase() === column.header.toLowerCase()
            );
            
            if (headerIndex !== -1) {
              rowData[column.accessorKey] = row.getCell(headerIndex + 1).text.trim();
            }
          }
        });
        console.log({rowData}, 1111111111)
        console.log(table.data)
        // Add non-editable data from the original table
        
        
        tableData.push(rowData);
      }
      
      return tableData;
    } catch (error) {
      console.error(`Error extracting data from subsection table "${table.title}":`, error);
      return [];
    }
  }
} 