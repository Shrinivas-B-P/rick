import request from 'supertest';
import app from '../index';
import mongoose from 'mongoose';
import { config } from '../config';

describe('RFQ API', () => {
  beforeAll(async () => {
    await mongoose.connect(config.mongoUri);
  });

  afterAll(async () => {
    await mongoose.connection.close();
  });

  describe('POST /api/rfq', () => {
    it('should create a new RFQ', async () => {
      const res = await request(app)
        .post('/api/rfq')
        .send({
          generalDetails: {
            title: 'Test RFQ',
            dueDate: new Date().toISOString(),
            status: 'draft'
          },
          scopeOfWork: [],
          questionnaire: [],
          items: []
        });

      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty('_id');
    });
  });
}); 