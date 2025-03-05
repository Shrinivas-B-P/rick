import { body } from 'express-validator';

export const rfqValidators = {
  create: [
    body('generalDetails.title')
      .trim()
      .notEmpty()
      .withMessage('Title is required')
      .isLength({ min: 3, max: 100 })
      .withMessage('Title must be between 3 and 100 characters'),
    
    body('generalDetails.dueDate')
      .isISO8601()
      .withMessage('Valid due date is required')
      .custom((value) => {
        if (new Date(value) < new Date()) {
          throw new Error('Due date cannot be in the past');
        }
        return true;
      }),
    
    body('generalDetails.status')
      .isIn(['draft', 'published', 'closed'])
      .withMessage('Invalid status')
  ]
}; 