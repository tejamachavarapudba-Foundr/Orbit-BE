import serverlessExpress from '@codegenie/serverless-express';
import { NestFactory } from '@nestjs/core';
import { ExpressAdapter } from '@nestjs/platform-express';
import express from 'express';
import { AppModule } from 'src/app.module';

let cachedServer: any;

async function bootstrap() {
  try {
    if (!cachedServer) {
      const expressApp = express();

      const compiled = require('../dist/api/index.js');
      module.exports = compiled.default || compiled;

      const nestApp = await NestFactory.create(
        AppModule,
        new ExpressAdapter(expressApp),
      );

      nestApp.enableCors();
      nestApp.setGlobalPrefix('api');

      await nestApp.init();

      cachedServer = serverlessExpress({ app: expressApp });
    }

    return cachedServer;
  } catch (err) {
    console.error('BOOTSTRAP ERROR:', err);
    throw err;
  }
}

export default async function handler(req: any, res: any) {
  try {
    const server = await bootstrap();

    return server(req, res);
  } catch (err) {
    console.error('HANDLER ERROR:', err);
    throw err;
  }
}
