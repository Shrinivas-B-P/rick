import mongoose, { Schema, Document } from "mongoose";

export interface SupplierQuoteRequestDocument extends Document {
  rfqId: mongoose.Types.ObjectId;
  supplierId: string;
  version: number;
  responseData: any;
  submittedAt: Date;
  status: "draft" | "submitted" | "accepted" | "rejected";
  notes?: string;
  attachments?: Array<{
    name: string;
    path: string;
    type: string;
    uploadedAt: Date;
  }>;
  createdAt: Date;
  updatedAt: Date;
  sectionsMap: any;
  commercialTable: any;
  commercialTermsTable: any;
  questionnaire: any;
}

const SupplierQuoteRequestSchema = new Schema(
  {
    rfqId: {
      type: Schema.Types.ObjectId,
      ref: "RFQ",
      required: true,
    },
    supplierId: {
      type: String,
      required: true,
    },
    version: {
      type: Number,
      default: 1,
    },
    responseData: {
      type: Schema.Types.Mixed,
      required: true,
    },
    submittedAt: {
      type: Date,
      default: Date.now,
    },
    status: {
      type: String,
      enum: ["draft", "submitted", "accepted", "rejected"],
      default: "submitted",
    },
    notes: {
      type: String,
    },
    attachments: [
      {
        name: String,
        path: String,
        type: String,
        uploadedAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],
    sectionsMap: {
      type: Schema.Types.Mixed,
      default: {},
    },
  },
  {
    timestamps: true,
    strict: false, // this has to be false to allow for dynamic sections data.
  }
);

// Create a compound index for rfqId and supplierId
SupplierQuoteRequestSchema.index({ rfqId: 1, supplierId: 1 });

export const SupplierQuoteRequestModel =
  mongoose.model<SupplierQuoteRequestDocument>(
    "SupplierQuoteRequest",
    SupplierQuoteRequestSchema
  );
