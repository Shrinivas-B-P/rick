import { Request, Response, NextFunction } from 'express';
// Temporarily comment out Joi import
// import Joi from 'joi';

export const validateRFQ = (req: Request, res: Response, next: NextFunction) => {
  // Temporarily skip validation and just pass through
  next();
  
  /* Comment out validation logic for now
  const schema = Joi.object({
    // ...
  });
  
  const { error } = schema.validate(req.body);
  
  if (error) {
    return res.status(400).json({
      success: false,
      message: 'Validation error',
      errors: error.details.map((detail: any) => ({
        message: detail.message,
        path: detail.path
      }))
    });
  }
  
  next();
  */
}; 