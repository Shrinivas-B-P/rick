import { RFQModel } from "../models/rfq.model";
import { RFQDocument } from "../types/rfq";
import { AppError } from "../middleware/error";
import { sendInvitationEmail } from "../services/email.service";
import { Supplier } from "../types/rfq";
import { Document, Types } from "mongoose";
import { RFQAnalysis, createAnalysisPayload } from "../utils/rfq.utils";

export class RFQService {
  create = async (
    data: any
  ): Promise<RFQDocument & { _id: Types.ObjectId }> => {
    try {
      const rfq = new RFQModel(data);
      const savedRFQ = await rfq.save();
      const rfqObject = savedRFQ.toObject();
      await this.sendSupplierEmails(rfqObject);
      return rfqObject;
    } catch (error) {
      throw new AppError(400, "Failed to create RFQ");
    }
  };

  private sendSupplierEmails = async (
    rfq: RFQDocument & { _id: Types.ObjectId }
  ) => {
    try {
      const emailPromises = rfq.suppliers.map((supplier) =>
        sendInvitationEmail(supplier.email, {
          rfqId: rfq._id,
          rfqTitle: rfq.generalDetails.title,
          supplierName: supplier.name,
          rfqData: rfq,
        })
      );
      await Promise.all(emailPromises);
    } catch (error) {
      console.error("Error sending supplier emails:", error);
    }
  };

  findAll = async (): Promise<(RFQDocument & { _id: Types.ObjectId })[]> => {
    try {
      const rfqs = await RFQModel.find().sort({ createdAt: -1 });
      return rfqs.map((rfq) => rfq.toObject());
    } catch (error) {
      throw new AppError(500, "Failed to fetch RFQs");
    }
  };

  findById = async (
    id: string
  ): Promise<RFQDocument & { _id: Types.ObjectId }> => {
    try {
      const rfq = await RFQModel.findById(id);
      if (!rfq) {
        throw new AppError(404, "RFQ not found");
      }
      return rfq.toObject();
    } catch (error) {
      throw new AppError(500, "Failed to fetch RFQ");
    }
  };

  update = async (
    id: string,
    data: any
  ): Promise<RFQDocument & { _id: Types.ObjectId }> => {
    try {
      const rfq = await RFQModel.findByIdAndUpdate(id, data, { new: true });
      if (!rfq) {
        throw new AppError(404, "RFQ not found");
      }
      return rfq.toObject();
    } catch (error) {
      throw new AppError(500, "Failed to update RFQ");
    }
  };

  delete = async (id: string): Promise<void> => {
    try {
      const rfq = await RFQModel.findByIdAndDelete(id);
      if (!rfq) {
        throw new AppError(404, "RFQ not found");
      }
    } catch (error) {
      throw new AppError(500, "Failed to delete RFQ");
    }
  };

  getAnalysis = async (id: string): Promise<RFQAnalysis> => {
    try {
      const rfq = await this.findById(id);
      if (!rfq) {
        throw new AppError(404, "RFQ not found");
      }
      return createAnalysisPayload(rfq);
    } catch (error) {
      throw new AppError(500, "Failed to fetch RFQ analysis");
    }
  };

  getRFQSuppliers = async (id: string): Promise<Supplier[]> => {
    try {
      const rfq = await RFQModel.findById(id);
      if (!rfq) {
        throw new AppError(404, "RFQ not found");
      }
      return rfq.suppliers || [];
    } catch (error) {
      throw new AppError(500, "Failed to fetch RFQ suppliers");
    }
  };

  sendRFQToSuppliers = async (id: string): Promise<void> => {
    try {
      const rfq = await RFQModel.findById(id);
      if (!rfq) {
        throw new AppError(404, "RFQ not found");
      }

      if (!rfq.suppliers || rfq.suppliers.length === 0) {
        throw new AppError(400, "No suppliers added to this RFQ");
      }

      await this.sendSupplierEmails(rfq.toObject());

      if (rfq.generalDetails.status === "draft") {
        rfq.generalDetails.status = "pending";
        await rfq.save();
      }
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw new AppError(500, "Failed to send RFQ to suppliers");
    }
  };
}
