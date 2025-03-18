declare module 'joi' {
  namespace Joi {
    interface ValidationErrorItem {
      message: string;
      path: (string | number)[];
      type: string;
      context?: any;
    }
    
    interface ValidationError extends Error {
      details: ValidationErrorItem[];
    }
  }
  
  export = Joi;
} 