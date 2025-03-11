import { Request, Response } from "express";
import { RFQModel } from "../models/rfq.model";
import { RFQ, RFQDocument, Supplier } from "../types/rfq";
import { sendInvitationEmail } from "../services/email.service";
import mongoose from "mongoose";
import { RFQService } from "../services/rfq.service";
import { AppError } from "../middleware/error";

export class RFQController {
  private rfqService: RFQService;

  constructor() {
    this.rfqService = new RFQService();
  }

  create = async (req: Request, res: Response) => {
    try {
      console.log("Creating RFQ with data:", JSON.stringify(req.body, null, 2));
      const savedRFQ = await this.rfqService.create(req.body);
      console.log("RFQ created successfully:", savedRFQ);
      res.status(201).json(savedRFQ);
    } catch (error) {
      console.error("Error creating RFQ:", error);
      res.status(500).json({
        message: "Failed to create RFQ",
        error: error instanceof Error ? error.message : "Unknown error",
        details: error,
      });
    }
  };

  getAll = async (req: Request, res: Response) => {
    try {
      const rfqs = await this.rfqService.findAll();
      res.json(rfqs);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch RFQs" });
    }
  };

  getById = async (req: Request, res: Response) => {
    try {
      const rfq = await this.rfqService.findById(req.params.id);
      res.json(rfq);
    } catch (error: any) {
      res.status(error.statusCode || 500).json({ error: error.message });
    }
  };

  update = async (req: Request, res: Response) => {
    try {
      const rfq = await this.rfqService.update(req.params.id, req.body);
      res.json(rfq);
    } catch (error: any) {
      res.status(error.statusCode || 500).json({ error: error.message });
    }
  };

  delete = async (req: Request, res: Response) => {
    try {
      await this.rfqService.delete(req.params.id);
      res.json({ message: "RFQ deleted successfully" });
    } catch (error: any) {
      res.status(error.statusCode || 500).json({ error: error.message });
    }
  };

  getRFQSuppliers = async (req: Request, res: Response) => {
    try {
      const suppliers = await this.rfqService.getRFQSuppliers(req.params.id);
      res.status(200).json(suppliers);
    } catch (error: any) {
      res.status(error.statusCode || 500).json({ message: error.message });
    }
  };

  addSupplierToRFQ = async (req: Request, res: Response) => {
    try {
      const { id, name, email } = req.body;

      if (!id || !name || !email) {
        return res
          .status(400)
          .json({ message: "Supplier id, name, and email are required" });
      }

      const rfq = (await RFQModel.findById(req.params.id)) as RFQDocument & {
        _id: mongoose.Types.ObjectId;
      };

      if (!rfq) {
        return res.status(404).json({ message: "RFQ not found" });
      }

      // Check if supplier already exists
      const supplierExists = rfq.suppliers.some(
        (supplier: Supplier) => supplier.id === id
      );

      if (supplierExists) {
        return res
          .status(400)
          .json({ message: "Supplier already added to this RFQ" });
      }

      // Add supplier
      rfq.suppliers.push({
        id,
        name,
        email,
        status: "invited",
      });

      await rfq.save();

      // Send invitation email to supplier with Excel attachment
      await sendInvitationEmail(email, {
        rfqId: rfq._id,
        rfqTitle: rfq.generalDetails.title,
        supplierName: name,
        rfqData: rfq, // Pass the entire RFQ data for Excel generation
      });

      res.status(201).json(rfq.suppliers);
    } catch (error: any) {
      res.status(error.statusCode || 500).json({ message: error.message });
    }
  };

  updateSupplierStatus = async (req: Request, res: Response) => {
    try {
      const { status } = req.body;

      if (
        !status ||
        !["invited", "accepted", "declined", "submitted"].includes(status)
      ) {
        return res.status(400).json({ message: "Valid status is required" });
      }

      const rfq = (await RFQModel.findById(req.params.id)) as RFQDocument & {
        _id: mongoose.Types.ObjectId;
      };

      if (!rfq) {
        return res.status(404).json({ message: "RFQ not found" });
      }

      const supplierIndex = rfq.suppliers.findIndex(
        (supplier: Supplier) => supplier.id.toString() === req.params.supplierId
      );

      if (supplierIndex === -1) {
        return res
          .status(404)
          .json({ message: "Supplier not found in this RFQ" });
      }

      // Update status
      rfq.suppliers[supplierIndex].status = status;

      // If status is 'submitted', add submission date
      if (status === "submitted") {
        rfq.suppliers[supplierIndex].submissionDate = new Date();
      }

      await rfq.save();

      res.status(200).json(rfq.suppliers[supplierIndex]);
    } catch (error: any) {
      res.status(error.statusCode || 500).json({ message: error.message });
    }
  };

  removeSupplierFromRFQ = async (req: Request, res: Response) => {
    try {
      const rfq = (await RFQModel.findById(req.params.id)) as RFQDocument & {
        _id: mongoose.Types.ObjectId;
      };

      if (!rfq) {
        return res.status(404).json({ message: "RFQ not found" });
      }

      const supplierIndex = rfq.suppliers.findIndex(
        (supplier: Supplier) => supplier.id.toString() === req.params.supplierId
      );

      if (supplierIndex === -1) {
        return res
          .status(404)
          .json({ message: "Supplier not found in this RFQ" });
      }

      // Remove supplier
      rfq.suppliers.splice(supplierIndex, 1);

      await rfq.save();

      res.status(200).json({ message: "Supplier removed successfully" });
    } catch (error: any) {
      res.status(error.statusCode || 500).json({ message: error.message });
    }
  };

  sendRFQToSuppliers = async (req: Request, res: Response) => {
    try {
      await this.rfqService.sendRFQToSuppliers(req.params.id);
      res
        .status(200)
        .json({ message: "RFQ sent to all suppliers successfully" });
    } catch (error: any) {
      res.status(error.statusCode || 500).json({ message: error.message });
    }
  };

  getAnalysis = async (req: Request, res: Response) => {
    try {
      const analysis = await this.rfqService.getAnalysis(req.params.id);
      res.status(200).json(analysis);
    } catch (error: any) {
      res.status(error.statusCode || 500).json({ error: error.message });
    }
  };
}
