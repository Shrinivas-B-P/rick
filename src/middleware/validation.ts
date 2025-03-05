import { Request, Response, NextFunction } from 'express';
import { body, validationResult } from 'express-validator';

export const validateRFQ = [
  // Validate top-level status
  body('status')
    .optional()
    .isIn(['pending', 'approved'])
    .withMessage('Status must be either pending or approved'),

  // Validate title
  body('generalDetails.title')
    .notEmpty()
    .withMessage('Title is required')
    .isString()
    .withMessage('Title must be a string'),

  // Validate generalDetails status
  body('generalDetails.status')
    .optional()
    .isIn(['pending', 'approved'])
    .withMessage('Status must be either pending or approved'),

  // Validate SOW sections
  body('scopeOfWork').isArray(),
  body('scopeOfWork.*.title').notEmpty(),
  
  // Validate questionnaire
  body('questionnaire').isArray(),
  body('questionnaire.*.title').notEmpty(),
  body('questionnaire.*.data').isArray(),
  
  // Validate items
  body('items').isArray(),
  body('items.*.title').notEmpty(),

  // Validate suppliers
  body('suppliers').isArray(),
  body('suppliers.*.id').notEmpty(),
  body('suppliers.*.name').notEmpty(),
  body('suppliers.*.email').notEmpty(),

  // Middleware to check validation results
  (req: Request, res: Response, next: NextFunction) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    next();
  }
]; 