import mongoose, { Schema, Document } from 'mongoose';
import { RFQDocument } from '../types/rfq';

// Define types for the SQR model
export interface SQRDocument extends Document {
  rfqId: mongoose.Types.ObjectId | string;
  supplierId: string;
  supplierName: string;
  supplierEmail: string;
  status: string;
  submissionDate?: Date;
  lastUpdated: Date;
  sections: Section[];
  attachments: Attachment[];
  comments: string;
  totalQuoteValue?: number;
  currency?: string;
}

interface Section {
  id: string;
  title: string;
  type: string;
  fields: Field[];
  subsections: Subsection[];
  tables: Table[];
  content?: string;
  visibleToSupplier: boolean;
  editableBySupplier: boolean;
}

interface Subsection {
  id: string;
  title: string;
  type: string;
  fields: Field[];
  tables: Table[];
  content?: string;
  visibleToSupplier: boolean;
  editableBySupplier: boolean;
}

interface Field {
  id: string;
  label: string;
  type: string;
  value: any;
  options?: string[];
  required: boolean;
  visibleToSupplier: boolean;
  editableBySupplier: boolean;
}

interface Table {
  id: string;
  title: string;
  columns: Column[];
  data: any[];
  visibleToSupplier: boolean;
  editableBySupplier: boolean;
}

interface Column {
  id: string;
  header: string;
  accessorKey: string;
  type: string;
  width?: number | string;
  visibleToSupplier: boolean;
  editableBySupplier: boolean;
}

interface Attachment {
  name: string;
  type: string;
  size: number;
  url: string;
  uploadedAt: Date;
  uploadedBy: string;
}

// Define the schema
const FieldSchema = new Schema({
  id: { type: String, required: true },
  label: { type: String, required: true },
  type: { type: String, required: true },
  value: { type: Schema.Types.Mixed },
  options: [String],
  required: { type: Boolean, default: false },
  visibleToSupplier: { type: Boolean, default: true },
  editableBySupplier: { type: Boolean, default: false }
}, { _id: false });

const ColumnSchema = new Schema({
  id: { type: String, required: true },
  header: { type: String, required: true },
  accessorKey: { type: String, required: true },
  type: { type: String, required: true },
  width: { type: Schema.Types.Mixed },
  visibleToSupplier: { type: Boolean, default: true },
  editableBySupplier: { type: Boolean, default: false }
}, { _id: false });

const TableSchema = new Schema({
  id: { type: String, required: true },
  title: { type: String, required: true },
  columns: [ColumnSchema],
  data: [Schema.Types.Mixed],
  visibleToSupplier: { type: Boolean, default: true },
  editableBySupplier: { type: Boolean, default: false }
}, { _id: false });

const SubsectionSchema = new Schema({
  id: { type: String, required: true },
  title: { type: String, required: true },
  type: { type: String, default: 'form' },
  fields: [FieldSchema],
  tables: [TableSchema],
  content: { type: String },
  visibleToSupplier: { type: Boolean, default: true },
  editableBySupplier: { type: Boolean, default: false }
}, { _id: false });

const SectionSchema = new Schema({
  id: { type: String, required: true },
  title: { type: String, required: true },
  type: { type: String, required: true },
  fields: [FieldSchema],
  subsections: [SubsectionSchema],
  tables: [TableSchema],
  content: { type: String },
  visibleToSupplier: { type: Boolean, default: true },
  editableBySupplier: { type: Boolean, default: false }
}, { _id: false });

const AttachmentSchema = new Schema({
  name: { type: String, required: true },
  type: { type: String, required: true },
  size: { type: Number, required: true },
  url: { type: String, required: true },
  uploadedAt: { type: Date, default: Date.now },
  uploadedBy: { type: String, required: true }
}, { _id: false });

const SQRSchema = new Schema({
  rfqId: {
    type: Schema.Types.ObjectId,
    ref: 'RFQ',
    required: true
  },
  supplierId: {
    type: String,
    required: true
  },
  supplierName: {
    type: String,
    required: true
  },
  supplierEmail: {
    type: String,
    required: true
  },
  status: {
    type: String,
    enum: ['draft', 'submitted', 'revised', 'accepted', 'rejected'],
    default: 'draft'
  },
  submissionDate: {
    type: Date
  },
  lastUpdated: {
    type: Date,
    default: Date.now
  },
  sections: [SectionSchema],
  attachments: [AttachmentSchema],
  comments: {
    type: String
  },
  totalQuoteValue: {
    type: Number
  },
  currency: {
    type: String
  }
}, {
  timestamps: true
});

// Create and export the model
export const SQRModel = mongoose.model<SQRDocument>('SQR', SQRSchema);

/**
 * Create a new SQR from an RFQ
 * This function filters the RFQ structure to only include supplier-visible sections and fields
 */
export async function createSQRFromRFQ(rfq: RFQDocument, supplierId: string, supplierName: string, supplierEmail: string): Promise<SQRDocument> {
  // Filter RFQ sections to only include those visible to suppliers
  const sections = processRFQSections(rfq);
  
  // Create the SQR document
  const sqr = new SQRModel({
    rfqId: rfq._id,
    supplierId,
    supplierName,
    supplierEmail,
    sections,
    comments: '',
    attachments: []
  });
  
  return await sqr.save();
}

/**
 * Process RFQ sections to create SQR sections
 * This filters out sections, subsections, fields, and tables not visible to suppliers
 */
function processRFQSections(rfq: RFQDocument): any[] {
  const sections: any[] = [];
  
  // Process template structure if available
  if (rfq.template && rfq.template.processedStructure && rfq.template.processedStructure.sections) {
    const templateSections = rfq.template.processedStructure.sections;
    
    for (const section of templateSections) {
      // Skip sections not visible to suppliers
      if (section.visibleToSupplier === false) {
        continue;
      }
      
      const processedSection = {
        id: section.id,
        title: section.title,
        type: section.type,
        fields: processFields(section.fields),
        subsections: processSubsections(section.subsections),
        tables: processTables(section.tables),
        content: section.content,
        visibleToSupplier: true,
        editableBySupplier: section.editableBySupplier || false
      };
      
      sections.push(processedSection);
    }
  } else {
    // Process RFQ structure directly if no template is available
    // General Details section
    sections.push({
      id: 'general-details',
      title: 'General Details',
      type: 'form',
      fields: [
        {
          id: 'title',
          label: 'RFQ Title',
          type: 'text',
          value: rfq.title,
          required: false,
          visibleToSupplier: true,
          editableBySupplier: false
        },
        {
          id: 'description',
          label: 'Description',
          type: 'text',
          value: rfq.description,
          required: false,
          visibleToSupplier: true,
          editableBySupplier: false
        },
        {
          id: 'dueDate',
          label: 'Due Date',
          type: 'date',
          value: rfq.dueDate,
          required: false,
          visibleToSupplier: true,
          editableBySupplier: false
        }
      ],
      subsections: [],
      tables: [],
      visibleToSupplier: true,
      editableBySupplier: false
    });
    
    // Scope of Work section
    if (rfq.scopeOfWork) {
      sections.push({
        id: 'scope-of-work',
        title: 'Scope of Work',
        type: 'sow',
        fields: [],
        subsections: [],
        tables: [],
        content: typeof rfq.scopeOfWork === 'string' 
          ? rfq.scopeOfWork 
          : JSON.stringify(rfq.scopeOfWork),
        visibleToSupplier: true,
        editableBySupplier: false
      });
    }
    
    // Questionnaire section
    if (rfq.questionnaire && Array.isArray(rfq.questionnaire)) {
      const questionnaireSection = {
        id: 'questionnaire',
        title: 'Questionnaire',
        type: 'form',
        fields: [],
        subsections: rfq.questionnaire.map(section => ({
          id: section.id || `section-${section.title}`,
          title: section.title,
          type: 'questionnaire',
          fields: [],
          tables: [{
            id: `table-${section.title}`,
            title: section.title,
            columns: [
              {
                id: 'question',
                header: 'Question',
                accessorKey: 'question',
                type: 'string',
                visibleToSupplier: true,
                editableBySupplier: false
              },
              {
                id: 'type',
                header: 'Type',
                accessorKey: 'type',
                type: 'string',
                visibleToSupplier: true,
                editableBySupplier: false
              },
              {
                id: 'options',
                header: 'Options',
                accessorKey: 'options',
                type: 'string',
                visibleToSupplier: true,
                editableBySupplier: false
              },
              {
                id: 'response',
                header: 'Response',
                accessorKey: 'response',
                type: 'string',
                visibleToSupplier: true,
                editableBySupplier: true
              }
            ],
            data: section.data ? section.data.map((item: any) => ({
              question: item.question || item.label,
              type: item.type,
              options: item.options ? (Array.isArray(item.options) ? item.options.join(', ') : item.options) : '',
              response: ''
            })) : [],
            visibleToSupplier: true,
            editableBySupplier: true
          }],
          visibleToSupplier: true,
          editableBySupplier: true
        })),
        tables: [],
        visibleToSupplier: true,
        editableBySupplier: true
      };
      
      sections.push(questionnaireSection);
    }
    
    // Items/Commercial section
    if (rfq.items && Array.isArray(rfq.items)) {
      const itemsSection = {
        id: 'commercial-table',
        title: 'Commercial Table',
        type: 'commercialTable',
        fields: [],
        subsections: [],
        tables: [{
          id: 'items-table',
          title: 'Items',
          columns: Object.keys(rfq.items[0] || {}).map(key => ({
            id: key,
            header: key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase()),
            accessorKey: key,
            type: 'string',
            visibleToSupplier: true,
            editableBySupplier: key === 'unitPrice' || key === 'quantity' || key === 'comments'
          })),
          data: rfq.items,
          visibleToSupplier: true,
          editableBySupplier: true
        }],
        visibleToSupplier: true,
        editableBySupplier: true
      };
      
      sections.push(itemsSection);
    }
    
    // Quote Summary section (for supplier to fill)
    sections.push({
      id: 'quote-summary',
      title: 'Quote Summary',
      type: 'form',
      fields: [
        {
          id: 'totalQuoteValue',
          label: 'Total Quote Value',
          type: 'number',
          value: '',
          required: true,
          visibleToSupplier: true,
          editableBySupplier: true
        },
        {
          id: 'currency',
          label: 'Currency',
          type: 'text',
          value: '',
          required: true,
          visibleToSupplier: true,
          editableBySupplier: true
        },
        {
          id: 'deliveryTime',
          label: 'Delivery Time (days)',
          type: 'number',
          value: '',
          required: true,
          visibleToSupplier: true,
          editableBySupplier: true
        },
        {
          id: 'validityPeriod',
          label: 'Quote Validity Period (days)',
          type: 'number',
          value: '30',
          required: true,
          visibleToSupplier: true,
          editableBySupplier: true
        },
        {
          id: 'comments',
          label: 'Additional Comments',
          type: 'textarea',
          value: '',
          required: false,
          visibleToSupplier: true,
          editableBySupplier: true
        }
      ],
      subsections: [],
      tables: [],
      visibleToSupplier: true,
      editableBySupplier: true
    });
  }
  
  return sections;
}

/**
 * Process fields to only include those visible to suppliers
 */
function processFields(fields: any[] = []): any[] {
  return fields
    .filter(field => field.visibleToSupplier !== false)
    .map(field => ({
      id: field.id,
      label: field.label,
      type: field.type,
      value: field.defaultValue || field.value || '',
      options: field.options,
      required: field.required || false,
      visibleToSupplier: true,
      editableBySupplier: field.editableBySupplier || false
    }));
}

/**
 * Process subsections to only include those visible to suppliers
 */
function processSubsections(subsections: any[] = []): any[] {
  return subsections
    .filter(subsection => subsection.visibleToSupplier !== false)
    .map(subsection => ({
      id: subsection.id,
      title: subsection.title,
      type: subsection.type || 'form',
      fields: processFields(subsection.fields),
      tables: processTables(subsection.tables),
      content: subsection.content,
      visibleToSupplier: true,
      editableBySupplier: subsection.editableBySupplier || false
    }));
}

/**
 * Process tables to only include those visible to suppliers
 */
function processTables(tables: any[] = []): any[] {
  return tables
    .filter(table => table.visibleToSupplier !== false)
    .map(table => ({
      id: table.id,
      title: table.title,
      columns: table.columns
        .filter((col: any) => col.visibleToSupplier !== false)
        .map((col: any) => ({
          id: col.id,
          header: col.header,
          accessorKey: col.accessorKey,
          type: col.type,
          width: col.width,
          visibleToSupplier: true,
          editableBySupplier: col.editableBySupplier || false
        })),
      data: table.data || [],
      visibleToSupplier: true,
      editableBySupplier: table.editableBySupplier || false
    }));
} 