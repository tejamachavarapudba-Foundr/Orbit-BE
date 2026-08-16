import './common/supabase.polyfill';
import { Logger, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { HttpErrorFilter } from './common/filters/http-exception.filter';
import { configure as serverlessExpress } from '@codegenie/serverless-express';

const logger = new Logger('Process');

// A single bad request should never take the whole server down for everyone
// else — log it and keep serving traffic instead of letting the process die.
process.on('unhandledRejection', (reason) => {
  logger.error(`Unhandled rejection: ${reason instanceof Error ? reason.stack : reason}`);
});

process.on('uncaughtException', (error) => {
  logger.error(`Uncaught exception: ${error.stack}`);
});

let cachedServer: any;

export async function bootstrapApp() {
  if (!cachedServer) {
    const app = await NestFactory.create(AppModule);

    app.enableCors();
    app.setGlobalPrefix('api');
    app.useGlobalFilters(new HttpErrorFilter());
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true })
    );

    await app.init();

    const expressApp = app.getHttpAdapter().getInstance();
    cachedServer = serverlessExpress({ app: expressApp });
  }
  return cachedServer;
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.enableCors();

  app.setGlobalPrefix('api');

  app.useGlobalFilters(new HttpErrorFilter());

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  const port = Number(process.env.PORT || 3000);

  await app.listen(port, '0.0.0.0');

  console.log(
    `🚀 Server running on http://0.0.0.0:${port}/api`,
  );
}

bootstrap();

// ==========================================================
// 🎯 FIXED: THE VERCEL SERVERLESS BRIDGE HANDLER WITH PROXY
// ==========================================================
export default async (req: any, res: any) => {
  const server = await bootstrapApp();
  return server(req, res);
};
