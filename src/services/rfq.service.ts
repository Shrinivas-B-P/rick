import { RFQModel, RFQDocument } from '../models/rfq.model';
import { AppError } from '../middleware/error';

export class RFQService {
  async create(data: any): Promise<RFQDocument> {
    try {
      const rfq = new RFQModel(data);
      return await rfq.save();
    } catch (error) {
      throw new AppError(400, 'Failed to create RFQ');
    }
  }

  async findAll(): Promise<RFQDocument[]> {
    try {
      return await RFQModel.find().sort({ createdAt: -1 });
    } catch (error) {
      throw new AppError(500, 'Failed to fetch RFQs');
    }
  }

  async findById(id: string): Promise<RFQDocument> {
    try {
      const rfq = await RFQModel.findById(id);
      if (!rfq) {
        throw new AppError(404, 'RFQ not found');
      }
      return rfq;
    } catch (error) {
      throw new AppError(500, 'Failed to fetch RFQ');
    }
  }

  async update(id: string, data: any): Promise<RFQDocument> {
    try {
      const rfq = await RFQModel.findByIdAndUpdate(id, data, { new: true });
      if (!rfq) {
        throw new AppError(404, 'RFQ not found');
      }
      return rfq;
    } catch (error) {
      throw new AppError(500, 'Failed to update RFQ');
    }
  }

  async delete(id: string): Promise<void> {
    try {
      const rfq = await RFQModel.findByIdAndDelete(id);
      if (!rfq) {
        throw new AppError(404, 'RFQ not found');
      }
    } catch (error) {
      throw new AppError(500, 'Failed to delete RFQ');
    }
  }
} 