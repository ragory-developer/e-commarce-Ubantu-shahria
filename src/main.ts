import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { NestExpressApplication } from '@nestjs/platform-express';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { ConfigService } from '@nestjs/config';

declare const module: any;

async function bootstrap() {
  const logger = new Logger('Bootstrap');

  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    // Keep Nest logs; adjust if you want less verbosity in production
    logger: ['error', 'warn', 'log', 'debug', 'verbose'],
  });

  // Use ConfigService to get config values set by ConfigModule
  const configService = app.get(ConfigService);
  const port =
    configService.get<number>('port') || Number(process.env.PORT) || 3000;
  const nodeEnv =
    configService.get<string>('nodeEnv') ||
    process.env.NODE_ENV ||
    'development';

  // Railway / proxy setup
  app.set('trust proxy', 1);

  // Security headers
  app.use(
    helmet({
      crossOriginResourcePolicy: false,
    }),
  );

  // CORS configuration:
  // You can provide a comma-separated list in CORS_ORIGINS env var (e.g. "https://ragory.tech,https://app.example.com")
  const corsOrigins = process.env.CORS_ORIGINS
    ? process.env.CORS_ORIGINS.split(',')
        .map((s) => s.trim())
        .filter(Boolean)
    : undefined;

  app.enableCors({
    origin: corsOrigins && corsOrigins.length ? corsOrigins : true,
    credentials: true,
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
  });

  // Global prefix and pipes
  app.setGlobalPrefix('api/v2');

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
    }),
  );

  // Swagger only when not in production or explicitly enabled
  if (nodeEnv !== 'production' || process.env.ENABLE_SWAGGER === 'true') {
    const config = new DocumentBuilder()
      .setTitle('E-commerce API')
      .setVersion('1.0')
      .addBearerAuth(
        {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          in: 'header',
        },
        'access-token', // ← this name MUST match @ApiBearerAuth('access-token')
      )
      .build();

    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('docs', app, document);
  }

  // Enable graceful shutdown hooks (Nest will call app.close() on signals)
  app.enableShutdownHooks();

  // HMR-safe: if module.hot exists (webpack HMR), dispose previous app
  if (module && module.hot) {
    module.hot.accept();
    module.hot.dispose(() => app.close());
  }

  // Prevent double-listen when the bootstrap function is (somehow) called again in the same process.
  // We store a flag on global object so repeated imports in the same process won't re-listen.
  await app.listen(port, '0.0.0.0');
  logger.log(`🚀 Running on port ${port}`);

  // Optional: handle signals explicitly to ensure clean shutdown on VPS
  const shutdown = async (signal: string) => {
    try {
      logger.log(
        `Received ${signal}. Closing http server and exiting gracefully.`,
      );
      await app.close();
      process.exit(0);
    } catch (err) {
      logger.error('Error during shutdown', (err as Error).message);
      process.exit(1);
    }
  };

  process.on('SIGINT', () => {
    void shutdown('SIGINT');
  });

  process.on('SIGTERM', () => {
    void shutdown('SIGTERM');
  });
}

bootstrap().catch((err) => {
  console.error('❌ Application failed to start', err);
  process.exit(1);
});
