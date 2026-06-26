import serverlessExpress from '@codegenie/serverless-express';
import { NestFactory } from '@nestjs/core';
import { ExpressAdapter } from '@nestjs/platform-express';
import express from 'express';
import { AppModule } from 'src/app.module';

let cachedServer: any;

async function bootstrap() {
  try {
    if (!cachedServer) {
      console.log('Starting Nest app...');

      const expressApp = express();
      
      const compiled = require('../dist/api/index.js');
      module.exports = compiled.default || compiled;
      
      const nestApp = await NestFactory.create(
        AppModule,
        new ExpressAdapter(expressApp),
      );

      console.log('Nest app created');

      nestApp.enableCors();
      nestApp.setGlobalPrefix('api');

      await nestApp.init();

      console.log('Nest app initialized');

      cachedServer = serverlessExpress({ app: expressApp });

      console.log('Serverless Express initialized');
    }

    return cachedServer;
  } catch (err) {
    console.error('BOOTSTRAP ERROR:', err);
    throw err;
  }
}

export default async function handler(req: any, res: any) {
  try {
    console.log('Incoming request:', req.url);

    const server = await bootstrap();

    return server(req, res);
  } catch (err) {
    console.error('HANDLER ERROR:', err);
    throw err;
  }
}
