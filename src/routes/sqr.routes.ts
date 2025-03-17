import express from 'express';
import { SQRController } from '../controllers/sqr.controller';

const router = express.Router();
const sqrController = new SQRController();

// Create SQR from RFQ
router.post('/', sqrController.createFromRFQ);

// Get SQR by ID
router.get('/:id', sqrController.getById);

// Get SQRs by RFQ ID
router.get('/rfq/:rfqId', sqrController.getByRFQId);

// Update SQR
router.put('/:id', sqrController.update);

// Delete SQR
router.delete('/:id', sqrController.delete);

// Download SQR Excel file
router.get('/:id/excel', sqrController.downloadExcel);

// Upload and process SQR Excel file
router.post('/:id/excel', sqrController.uploadExcel);

// Submit SQR
router.post('/:id/submit', sqrController.submitSQR);

export default router; 