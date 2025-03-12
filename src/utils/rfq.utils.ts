import { RFQDocument, Supplier } from "../types/rfq";
import { Types } from "mongoose";

export interface RFQAnalysis {
  id: string;
  title: string;
  status: string;
  items: Record<string, string>[];
  suppliers: Supplier[];
  commercialTerms: Record<string, string>[];
  questionnaires: {
    id: string;
    title: string;
    questions: any[]; // Update this type based on your actual questionnaire data structure
  }[];
}

export const createAnalysisPayload = (
  rfq: RFQDocument & { _id: Types.ObjectId }
): RFQAnalysis => {
  const items = rfq.items[0]?.tables[0]?.data;
  const commercialTerms = rfq.comercialTable[0]?.tables[0]?.data;
  return {
    id: rfq._id.toString(),
    title: rfq.generalDetails.title,
    status: rfq.generalDetails.status,
    items: items.map((item: Record<string, string>) => ({
      id: item.id,
      type: item["item-type"],
      product: item["item-name"],
      description: item["item-description"],
      quantity: item["quantity"],
      unit: item["unit-of-measurement"],
    })),
    suppliers: rfq.suppliers.map((supplier: Supplier) => ({
      id: supplier.id,
      name: supplier.name,
      email: supplier.email,
      status: supplier.status,
    })),
    questionnaires: rfq.questionnaire.map((questionnaire: any) => ({
      id: questionnaire.id,
      title: questionnaire.title,
      questions: questionnaire.data,
    })),
    commercialTerms: commercialTerms.map((term: Record<string, string>) => ({
      id: term.id,
      type: term["item-type"],
      product: term["item-name"],
      description: term["item-description"],
      quantity: term["quantity"],
      unit: term["unit-of-measurement"],
    })),
  };
};
