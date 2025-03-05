import winston from 'winston';
import { config } from '../config';

const logger = winston.createLogger({
  level: config.env === 'development' ? 'debug' : 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.File({ filename: 'error.log', level: 'error' }),
    new winston.transports.File({ filename: 'combined.log' })
  ]
});

if (config.env === 'development') {
  logger.add(new winston.transports.Console({
    format: winston.format.simple()
  }));
}

export default logger; 