import { Document, Types } from 'mongoose';

export interface GeneralDetails {
  id: string;
  title: string;
  description?: string;
  dueDate: Date;
  status: 'draft' | 'published' | 'closed';
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
  id: number;
  name: string;
  email: string;
  status: string;
  submissionDate?: Date;
  responseData?: any;
}

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
  createdBy?: Types.ObjectId;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface RFQDocument extends Document, RFQ {} 