// Initialize tracing before any other imports
import './infrastructure/monitoring/tracing.service';

import 'reflect-metadata';
import { Application } from './infrastructure/web/application';
import { Logger } from './infrastructure/logging/logger';
import { TracingService } from './infrastructure/monitoring/tracing.service';

const logger = Logger.getInstance();

async function bootstrap(): Promise<void> {
  try {
    const app = new Application();
    await app.start();
    
    logger.info('Payment Microservice started successfully');
  } catch (error) {
    logger.error('Failed to start Payment Microservice', error);
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, shutting down gracefully');
  
  try {
    const tracingService = TracingService.getInstance();
    await tracingService.shutdown();
    logger.info('Tracing shutdown completed');
  } catch (error) {
    logger.error('Error during tracing shutdown', error);
  }
  
  process.exit(0);
});

process.on('SIGINT', async () => {
  logger.info('SIGINT received, shutting down gracefully');
  
  try {
    const tracingService = TracingService.getInstance();
    await tracingService.shutdown();
    logger.info('Tracing shutdown completed');
  } catch (error) {
    logger.error('Error during tracing shutdown', error);
  }
  
  process.exit(0);
});

bootstrap().catch((error) => {
  logger.error('Bootstrap failed', error);
  process.exit(1);
});