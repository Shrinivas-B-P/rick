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
  const items = rfq.commercialTable?.tables[0]?.data;
  const commercialTerms = rfq.commercialTermsTable?.tables[0]?.data;
  return {
    id: rfq._id.toString(),
    title: rfq.generalDetails.title,
    status: rfq.generalDetails.status,
    items: items.map((item: Record<string, string>) => ({
      id: item.id,
      type: item.type,
      product: item.item,
      description: item.description,
      quantity: Number(item.qty),
      unit: item.uom,
    })),
    suppliers:
      rfq.suppliers?.map((supplier: Supplier) => ({
        id: supplier.id,
        name: supplier.name,
        email: supplier.email,
        status: supplier.status,
      })) || [],
    questionnaires: rfq.questionnaire.subsections.map((questionnaire: any) => ({
      id: questionnaire.id,
      title: questionnaire.title,
      questions: questionnaire.tables[0]?.data || [],
    })),
    commercialTerms: commercialTerms.map((term: Record<string, string>) => ({
      id: term.id,
      type: term.type,
      product: term.term,
      description: term.description,
      quantity: Number(term.qty),
      unit: term.uom,
    })),
  };
};
