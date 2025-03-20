import express from 'express';
import cors from 'cors';
import bodyParser from 'body-parser';
import responseFormatter from './middleware/transform.middleware';
import rfqRoutes from './routes/rfq.routes';

const app = express();

// Basic middleware
app.use(cors());
app.use(bodyParser.json({ limit: '50mb' }));
app.use(bodyParser.urlencoded({ extended: true, limit: '50mb' }));

// Test middleware
app.use((req, res, next) => {
  next();
});

// Then your transform middleware
app.use(responseFormatter);

// Routes
app.use('/api/rfq', rfqRoutes);
// ... other routes

// Error handling middleware should be last
// app.use(errorHandler);

export default app; 