import { Document, Types } from "mongoose";
import mongoose from "mongoose";

export interface GeneralDetails {
  id: string;
  title: string;
  description?: string;
  dueDate: Date;
  status: "draft" | "published" | "closed";
  createdAt: Date;
  updatedAt: Date;
}

export interface SowSection {
  id: string;
  title: string;
  content?: {
    heading: string;
    description: string;
  }[];
  sections?: {
    id: string;
    title: string;
    content?: {
      heading: string;
      description: string;
    }[];
  }[];
}

export interface QuestionnaireData {
  id: string;
  question: string;
  type: string;
  value?: any;
  options?: string[];
  remarks?: string;
  required?: boolean;
}

export interface QuestionnaireSection {
  id: string;
  title: string;
  data: QuestionnaireData[];
}

export interface ItemSection {
  id: string;
  title: string;
  tables?: {
    id: string;
    data: any[];
  }[];
  data?: any[];
}

export interface Supplier {
  id: string | number;
  name?: string;
  email?: string;
  phone?: string;
  address?: string;
  contactPerson?: string;
  status?: "pending" | "invited" | "responded" | "selected" | "rejected";
  response?: any;
  responseSubmittedAt?: Date;
  excelUUID?: string;
  excelGeneratedAt?: Date;
}

export interface RFQ {
  title: string;
  description?: string;
  status?: string;
  dueDate?: Date;
  createdBy?: string | mongoose.Types.ObjectId;
  createdAt?: Date;
  updatedAt?: Date;
  scopeOfWork?: any;
  questionnaire?: any;
  items?: any;
  suppliers?: Supplier[];
  attachments?: any[];
  [key: string]: any; // Allow any additional properties
}

export interface RFQDocument extends mongoose.Document, RFQ {
  createdBy?: string | mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

export interface NegotiationResponse {
  supplierId: number;
  products: Array<{
    productId: string;
    negotiation?: any;
  }>;
  commercialTerms: Array<{
    key: string;
    negotiation?: any;
  }>;
  questionnaires: Array<{
    key: string;
    questions: Array<{
      key: string;
      negotiation?: any;
    }>;
  }>;
}
