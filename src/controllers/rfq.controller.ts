import { Request, Response } from 'express';
import { RFQModel } from '../models/rfq.model';
import { RFQ, RFQDocument, Supplier } from '../types/rfq';
import { sendInvitationEmail } from '../services/email.service';
import mongoose from 'mongoose';

export class RFQController {
  async create(req: Request, res: Response) {
    try {
      // Log the incoming request data
      console.log('Creating RFQ with data:', JSON.stringify(req.body, null, 2));

      // Ensure generalDetails has proper structure
      const { generalDetails, ...restData } = req.body;
      
      // Create the RFQ with validated data
      const rfq = new RFQModel({
        ...restData,
        generalDetails: {
          ...generalDetails,
          // Ensure arrays exist
          _fields: generalDetails._fields || [],
          _subsections: generalDetails._subsections || []
        }
      });

      const savedRFQ = await rfq.save() as RFQDocument & { _id: mongoose.Types.ObjectId };
      
      // If suppliers were added, send emails to them automatically
      if (savedRFQ.suppliers && savedRFQ.suppliers.length > 0) {
        try {
          // Send emails to all suppliers
          const emailPromises = savedRFQ.suppliers.map((supplier: Supplier) => 
            sendInvitationEmail(supplier.email, {
              rfqId: savedRFQ._id,
              rfqTitle: savedRFQ.generalDetails.title,
              supplierName: supplier.name,
              rfqData: savedRFQ // Pass the entire RFQ data for Excel generation
            })
          );
          
          await Promise.all(emailPromises);
          console.log('Emails sent to all suppliers successfully');
        } catch (emailError) {
          console.error('Error sending emails to suppliers:', emailError);
          // We continue even if emails fail - the RFQ is still created
        }
      }
      
      console.log('RFQ created successfully:', savedRFQ);
      res.status(201).json(savedRFQ);
    } catch (error) {
      console.error('Error creating RFQ:', error);
      res.status(500).json({
        message: 'Failed to create RFQ',
        error: error instanceof Error ? error.message : 'Unknown error',
        details: error
      });
    }
  }

  async getAll(req: Request, res: Response) {
    try {
      const rfqs = await RFQModel.find();
      res.json(rfqs);
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch RFQs' });
    }
  }

  async getById(req: Request, res: Response) {
    try {
      const rfq = await RFQModel.findById(req.params.id);
      if (!rfq) {
        return res.status(404).json({ error: 'RFQ not found' });
      }
      res.json(rfq);
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch RFQ' });
    }
  }

  async update(req: Request, res: Response) {
    try {
      const rfq = await RFQModel.findByIdAndUpdate(
        req.params.id,
        req.body,
        { new: true }
      );
      if (!rfq) {
        return res.status(404).json({ error: 'RFQ not found' });
      }
      res.json(rfq);
    } catch (error) {
      res.status(500).json({ error: 'Failed to update RFQ' });
    }
  }

  async delete(req: Request, res: Response) {
    try {
      const rfq = await RFQModel.findByIdAndDelete(req.params.id);
      if (!rfq) {
        return res.status(404).json({ error: 'RFQ not found' });
      }
      res.json({ message: 'RFQ deleted successfully' });
    } catch (error) {
      res.status(500).json({ error: 'Failed to delete RFQ' });
    }
  }

  // Get all suppliers for an RFQ
  async getRFQSuppliers(req: Request, res: Response) {
    try {
      const rfq = await RFQModel.findById(req.params.id) as RFQDocument & { _id: mongoose.Types.ObjectId };
      
      if (!rfq) {
        return res.status(404).json({ message: 'RFQ not found' });
      }
      
      res.status(200).json(rfq.suppliers);
    } catch (error) {
      res.status(500).json({ message: 'Error fetching suppliers', error });
    }
  }

  // Add a supplier to an RFQ
  async addSupplierToRFQ(req: Request, res: Response) {
    try {
      const { id, name, email } = req.body;
      
      if (!id || !name || !email) {
        return res.status(400).json({ message: 'Supplier id, name, and email are required' });
      }
      
      const rfq = await RFQModel.findById(req.params.id) as RFQDocument & { _id: mongoose.Types.ObjectId };
      
      if (!rfq) {
        return res.status(404).json({ message: 'RFQ not found' });
      }
      
      // Check if supplier already exists
      const supplierExists = rfq.suppliers.some((supplier: Supplier) => supplier.id === id);
      
      if (supplierExists) {
        return res.status(400).json({ message: 'Supplier already added to this RFQ' });
      }
      
      // Add supplier
      rfq.suppliers.push({
        id,
        name,
        email,
        status: 'invited'
      });
      
      await rfq.save();
      
      // Send invitation email to supplier with Excel attachment
      await sendInvitationEmail(email, {
        rfqId: rfq._id,
        rfqTitle: rfq.generalDetails.title,
        supplierName: name,
        rfqData: rfq // Pass the entire RFQ data for Excel generation
      });
      
      res.status(201).json(rfq.suppliers);
    } catch (error) {
      res.status(500).json({ message: 'Error adding supplier', error });
    }
  }

  // Update supplier status
  async updateSupplierStatus(req: Request, res: Response) {
    try {
      const { status } = req.body;
      
      if (!status || !['invited', 'accepted', 'declined', 'submitted'].includes(status)) {
        return res.status(400).json({ message: 'Valid status is required' });
      }
      
      const rfq = await RFQModel.findById(req.params.id) as RFQDocument & { _id: mongoose.Types.ObjectId };
      
      if (!rfq) {
        return res.status(404).json({ message: 'RFQ not found' });
      }
      
      const supplierIndex = rfq.suppliers.findIndex(
        (supplier: Supplier) => supplier.id.toString() === req.params.supplierId
      );
      
      if (supplierIndex === -1) {
        return res.status(404).json({ message: 'Supplier not found in this RFQ' });
      }
      
      // Update status
      rfq.suppliers[supplierIndex].status = status;
      
      // If status is 'submitted', add submission date
      if (status === 'submitted') {
        rfq.suppliers[supplierIndex].submissionDate = new Date();
      }
      
      await rfq.save();
      
      res.status(200).json(rfq.suppliers[supplierIndex]);
    } catch (error) {
      res.status(500).json({ message: 'Error updating supplier status', error });
    }
  }

  // Remove supplier from RFQ
  async removeSupplierFromRFQ(req: Request, res: Response) {
    try {
      const rfq = await RFQModel.findById(req.params.id) as RFQDocument & { _id: mongoose.Types.ObjectId };
      
      if (!rfq) {
        return res.status(404).json({ message: 'RFQ not found' });
      }
      
      const supplierIndex = rfq.suppliers.findIndex(
        (supplier: Supplier) => supplier.id.toString() === req.params.supplierId
      );
      
      if (supplierIndex === -1) {
        return res.status(404).json({ message: 'Supplier not found in this RFQ' });
      }
      
      // Remove supplier
      rfq.suppliers.splice(supplierIndex, 1);
      
      await rfq.save();
      
      res.status(200).json({ message: 'Supplier removed successfully' });
    } catch (error) {
      res.status(500).json({ message: 'Error removing supplier', error });
    }
  }

  // Add a new method to send RFQ to all suppliers
  async sendRFQToSuppliers(req: Request, res: Response) {
    try {
      const rfq = await RFQModel.findById(req.params.id) as RFQDocument & { _id: mongoose.Types.ObjectId };
      
      if (!rfq) {
        return res.status(404).json({ message: 'RFQ not found' });
      }
      
      if (!rfq.suppliers || rfq.suppliers.length === 0) {
        return res.status(400).json({ message: 'No suppliers added to this RFQ' });
      }
      
      // Send emails to all suppliers
      const emailPromises = rfq.suppliers.map((supplier: Supplier) => 
        sendInvitationEmail(supplier.email, {
          rfqId: rfq._id,
          rfqTitle: rfq.generalDetails.title,
          supplierName: supplier.name,
          rfqData: rfq // Pass the entire RFQ data for Excel generation
        })
      );
      
      await Promise.all(emailPromises);
      
      // Update RFQ status if needed
      if (rfq.generalDetails.status === 'draft') {
        rfq.generalDetails.status = 'pending';
        await rfq.save();
      }
      
      res.status(200).json({ message: 'RFQ sent to all suppliers successfully' });
    } catch (error) {
      res.status(500).json({ message: 'Error sending RFQ to suppliers', error });
    }
  }
} 