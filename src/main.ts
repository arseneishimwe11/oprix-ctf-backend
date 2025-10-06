import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module';
import { setupSwagger } from './config/swagger.config';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { ValidationExceptionFilter } from './common/filters/validation-exception.filter';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';
import compression from 'compression';
import helmet from 'helmet';

async function bootstrap() {
  const logger = new Logger('Bootstrap');

  // Create NestJS application
  const app = await NestFactory.create(AppModule, {
    logger: ['log', 'error', 'warn', 'debug', 'verbose'],
  });

  // Get config service
  const configService = app.get(ConfigService);
  const port = configService.get<number>('app.port') || 3000;
  const env = configService.get<string>('app.env') || 'development';
  const corsOrigins = configService.get<string[]>('app.corsOrigins') || [];

  // Apply global prefix
  app.setGlobalPrefix('api/v1');

  // Security: Helmet
  app.use(helmet({
    contentSecurityPolicy: env === 'production',
    crossOriginEmbedderPolicy: false,
  }));

  // Compression
  app.use(compression());

  // CORS
  app.enableCors({
    origin: corsOrigins,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Accept'],
  });

  // Global validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  // Global exception filters
  app.useGlobalFilters(
    new HttpExceptionFilter(),
    new ValidationExceptionFilter(),
  );

  // Global interceptors
  app.useGlobalInterceptors(new LoggingInterceptor());

  // Setup Swagger documentation
  if (env === 'development') {
    setupSwagger(app);
    logger.log('Swagger documentation available at /api/v1/docs');
  }

  // Graceful shutdown
  app.enableShutdownHooks();

  // Start server
  await app.listen(port);
  
  logger.log(`Application running in ${env} mode`);
  logger.log(`Server listening on http://localhost:${port}`);
  logger.log(`API available at http://localhost:${port}/api/v1`);
}

bootstrap().catch((error) => {
  console.error('Application failed to start:', error);
  process.exit(1);
});
