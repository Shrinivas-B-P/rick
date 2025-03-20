import { SupplierQuoteRequestDocument } from "@/models/supplier-quote-request.model";
import { RFQDocument, Supplier } from "../types/rfq";
import { Types } from "mongoose";

export interface QuestionnaireQuestion {
  id: string;
  "s-no": number;
  question: string;
  type: "single-select" | "multi-select" | "text" | "number" | string;
  value: string;
  remarks: string;
  required: boolean;
  options?: string[];
  response?: string;
}

export interface Questionnaire {
  id: string;
  title: string;
  questions: QuestionnaireQuestion[];
}

export interface RFQAnalysis {
  id: string;
  title: string;
  status: string;
  items: Record<string, string>[];
  suppliers: Supplier[];
  commercialTerms: Record<string, string>[];
  questionnaires: Questionnaire[];
}

export interface SupplierQuoteAnalysis {
  id: string;
  supplierId: string;
  items: Record<string, string>[];
  questionnaires: Questionnaire[];
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
    suppliers:
      rfq.suppliers?.map((supplier: Supplier) => ({
        id: supplier.id,
        name: supplier.name,
        email: supplier.email,
        status: supplier.status,
      })) || [],
    items: items.map((item: Record<string, string>) => ({
      id: item.id,
      type: item.type,
      product: item.item,
      description: item.description,
      quantity: Number(item.qty),
      unit: item.uom,
      negotiation: item.negotiation,
    })),
    questionnaires: rfq.questionnaire.subsections.map((questionnaire: any) => ({
      id: questionnaire.id,
      title: questionnaire.title,
      questions: questionnaire.tables[0]?.data || [],
    })),
    commercialTerms: commercialTerms.map((term: Record<string, string>) => ({
      id: term.id,
      term: term.term,
      description: term.description,
      negotiation: term.negotiation,
    })),
  };
};

export const createSupplierQuotesForAnalysis = (
  supplierQuotes: SupplierQuoteRequestDocument[]
): SupplierQuoteAnalysis[] => {
  const supplierQuotesForAnalysis = supplierQuotes.map((quote) => {
    const items = quote.commercialTable?.tables[0]?.data;
    const commercialTerms = quote.commercialTermsTable?.tables[0]?.data;
    return {
      id: quote._id.toString(),
      supplierId: quote.supplierId,
      items: items.map((item: Record<string, string>) => ({
        id: item.id,
        type: item.type,
        product: item.item,
        description: item.description,
        quantity: Number(item.qty),
        unit: item.uom,
        price: Number(item["unit-price"]),
      })),
      questionnaires: quote.questionnaire.subsections.map(
        (questionnaire: any) => ({
          id: questionnaire.id,
          title: questionnaire.title,
          questions: questionnaire.tables[0]?.data || [],
        })
      ),
      commercialTerms: commercialTerms.map((term: Record<string, string>) => ({
        id: term.id,
        term: term.term,
        description: term.description,
        response: term["user-response"],
      })),
    };
  });
  return supplierQuotesForAnalysis;
};
