// Extend Express Request type to include user
declare namespace Express {
  export interface Request {
    user?: {
      id: string;
      email: string;
      role: string;
    };
  }
} 