import mongoose, { Document, Schema } from 'mongoose';
import { RFQ as RFQType, QuestionnaireData, RFQDocument as RFQDocType, Supplier } from '../types/rfq';

// Update the RFQ interface to include suppliers
export interface RFQ {
  status: string;
  generalDetails: {
    title: string;
    status: string;
    fields: any[];
    subsections: any[];
    [key: string]: any;
  };
  scopeOfWork: any[];
  questionnaire: any[];
  items: any[];
  suppliers: Supplier[];
  termsAndConditions: {
    timestamp: string;
    fields: any[];
    subsections: any[];
  };
  createdBy?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface RFQDocument extends RFQ, Document {}

// Add these interfaces at the top of the file
interface FieldMetadata {
  id: string;
  label: string;
  type: string;
  required: boolean;
  value?: any;
}

interface Subsection {
  id: string;
  title: string;
  fields: FieldMetadata[];
}

const fieldMetadataSchema = new mongoose.Schema({
  id: String,
  label: String,
  type: String,
  required: Boolean
}, { _id: false });

const subsectionFieldSchema = new mongoose.Schema({
  id: String,
  label: String,
  type: String,
  required: Boolean,
  value: mongoose.Schema.Types.Mixed
}, { _id: false });

const subsectionSchema = new mongoose.Schema({
  id: String,
  title: String,
  fields: [subsectionFieldSchema]
}, { _id: false });

// Define schemas for nested types
const questionnaireDataSchema = new mongoose.Schema({
  id: String,
  question: String,
  type: {
    type: String,
    get: (v: any) => typeof v === 'object' ? v.value : v
  },
  value: mongoose.Schema.Types.Mixed,
  options: {
    type: [String],
    default: []
  },
  required: Boolean,
  remarks: String,
  isAddNewRow: Boolean
}, { _id: false });

const columnSchema = new mongoose.Schema({
  id: String,
  header: String,
  accessorKey: String,
  type: String
}, { _id: false });

const questionnaireSectionSchema = new mongoose.Schema({
  id: String,
  title: String,
  columns: [columnSchema],
  data: [questionnaireDataSchema]
}, { _id: false });

const tableSchema = new mongoose.Schema({
  id: String,
  columns: [columnSchema],
  data: [mongoose.Schema.Types.Mixed]
}, { _id: false });

const itemSectionSchema = new mongoose.Schema({
  id: String,
  title: String,
  tables: [tableSchema]
}, { _id: false });

const supplierSchema = new mongoose.Schema({
  id: {
    type: Number,
    required: true
  },
  name: {
    type: String,
    required: true
  },
  email: {
    type: String,
    required: true
  },
  phone: String,
  address: String,
  contactPerson: String,
  status: {
    type: String,
    enum: ['pending', 'invited', 'responded', 'selected', 'rejected'],
    default: 'pending'
  },
  response: mongoose.Schema.Types.Mixed,
  responseSubmittedAt: Date,
  excelUUID: String,
  excelGeneratedAt: Date,
  submissionDate: Date,
  excelFile: {
    fileId: String,
    fileName: String,
    generatedAt: Date,
    downloadUrl: String
  }
}, { _id: false });

const RFQSchema = new Schema({
  title: {
    type: String,
    required: [true, 'Title is required']
  },
  description: {
    type: String
  },
  status: {
    type: String,
    default: 'Draft'
  },
  dueDate: {
    type: Date
  },
  createdBy: {
    type: Schema.Types.Mixed // Allow string or ObjectId
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  },
  // Use Schema.Types.Mixed for complex nested structures
  scopeOfWork: {
    type: Schema.Types.Mixed
  },
  questionnaire: {
    type: Schema.Types.Mixed
  },
  items: {
    type: Schema.Types.Mixed
  },
  suppliers: {
    type: [supplierSchema],
    default: []
  },
  attachments: [{
    type: Schema.Types.Mixed
  }],
  termsAndConditions: {
    type: mongoose.Schema.Types.Mixed,
    required: true,
    validate: {
      validator: function(value: any) {
        return value && 
               typeof value === 'object' &&
               Object.keys(value).length > 0 &&
               value.timestamp;
      },
      message: 'Terms and conditions must include at least one field and a timestamp'
    }
  }
}, {
  timestamps: true,
  strict: false // Allow additional fields not defined in the schema
});

// Fix the pre-save hook to handle Mongoose document arrays correctly
RFQSchema.pre('save', function(next) {
  const rfq = this as unknown as RFQDocType;
  
  // Ensure generalDetails has proper structure
  if (rfq.generalDetails) {
    // Ensure fields is an array
    if (!Array.isArray(rfq.generalDetails.fields)) {
      rfq.generalDetails.fields = [];
    }

    // Ensure subsections is an array
    if (!Array.isArray(rfq.generalDetails.subsections)) {
      rfq.generalDetails.subsections = [];
    }

    // Validate field metadata structure
    rfq.generalDetails.fields = rfq.generalDetails.fields.map((field: any): FieldMetadata => ({
      id: field.id || '',
      label: field.label || '',
      type: field.type || 'text',
      required: !!field.required
    }));

    // Validate subsection structure
    rfq.generalDetails.subsections = rfq.generalDetails.subsections.map((subsection: any): Subsection => ({
      id: subsection.id || '',
      title: subsection.title || '',
      fields: (subsection.fields || []).map((field: any): FieldMetadata => ({
        id: field.id || '',
        label: field.label || '',
        type: field.type || 'text',
        required: !!field.required,
        value: field.value
      }))
    }));
  }

  // Update the updatedAt timestamp
  this.updatedAt = new Date();
  
  // Process questionnaire data if it exists
  // Instead of directly modifying the array, we'll update each item individually
  if (this.questionnaire && Array.isArray(this.questionnaire)) {
    for (let i = 0; i < this.questionnaire.length; i++) {
      const section = this.questionnaire[i];
      if (section.data && Array.isArray(section.data)) {
        for (let j = 0; j < section.data.length; j++) {
          const field = section.data[j];
          // Update the field properties directly
          field.required = !!field.required;
        }
      }
    }
  }

  next();
});

// Fix the pre-validate hook to handle Mongoose DocumentArray correctly
RFQSchema.pre('validate', function(next) {
  // If suppliers exist, ensure they have valid status values
  if (this.suppliers && Array.isArray(this.suppliers)) {
    // Instead of replacing the entire array, update each supplier individually
    for (let i = 0; i < this.suppliers.length; i++) {
      const supplier = this.suppliers[i];
      if (supplier.status === 'pending') {
        // Update the status directly
        supplier.status = 'invited';
      }
    }
  }
  next();
});

export const RFQModel = mongoose.model<RFQDocType>('RFQ', RFQSchema); 