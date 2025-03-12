import { RFQDocument } from "../types/rfq";
import { Types } from "mongoose";
import { Supplier } from "../types/rfq";

export interface RFQAnalysis {
  id: string;
  title: string;
  status: string;
  items: Record<string, string>[];
  suppliers: Supplier[];
}

export const createAnalysisPayload = (
  rfq: RFQDocument & { _id: Types.ObjectId }
): RFQAnalysis => {
  const items = rfq.items[0]?.tables[0]?.data;
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
  };
};
