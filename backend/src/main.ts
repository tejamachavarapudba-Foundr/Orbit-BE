import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';

let cachedApp: any;

export async function bootstrapApp() {
  if (!cachedApp) {
    const app = await NestFactory.create(AppModule);
    
    // Enable CORS so your React Native app can talk to the backend safely
    app.enableCors();
    app.setGlobalPrefix('api');
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true })
    );
    
    await app.init();
    cachedApp = app;
  }
  return cachedApp;
}

async function bootstrap() {
  // Only start a listening server if we are running locally, not on Vercel
  if (process.env.NODE_ENV !== 'production' && !process.env.VERCEL) {
    const app = await NestFactory.create(AppModule);
    app.enableCors();
    app.setGlobalPrefix('api');
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true })
    );
    
    const port = Number(process.env.PORT ?? 3000);
    await app.listen(port, '0.0.0.0');
    console.log(`API listening locally on http://localhost:${port}/api`);
  }
}


bootstrap();
// ==========================================================
// 🎯 STEP 3: THE VERCEL SERVERLESS BRIDGE HANDLER (ADD THIS)
// ==========================================================
export default async (req: any, res: any) => {
  const app = await bootstrapApp();
  const server = app.getHttpAdapter().getInstance();
  return server(req, res);
};
