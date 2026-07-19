import './common/supabase.polyfill';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';
import { configure as serverlessExpress } from '@codegenie/serverless-express';

let cachedServer: any;

export async function bootstrapApp() {
  if (!cachedServer) {
    const app = await NestFactory.create(AppModule);
    
    app.enableCors();
    app.setGlobalPrefix('api');
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
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  const port = Number(process.env.PORT || 3000);

  await app.listen(port, '0.0.0.0');

  console.log(`API listening on port ${port}`);
}

bootstrap();

// ==========================================================
// 🎯 FIXED: THE VERCEL SERVERLESS BRIDGE HANDLER WITH PROXY
// ==========================================================
export default async (req: any, res: any) => {
  const server = await bootstrapApp();
  return server(req, res);
};

