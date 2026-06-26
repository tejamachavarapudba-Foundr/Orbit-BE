import serverlessExpress from "@codegenie/serverless-express";
import { NestFactory } from "@nestjs/core";
import { ExpressAdapter } from "@nestjs/platform-express";
import express from "express";

import { AppModule } from "../src/app.module";

let server: any;

async function bootstrap() {
  if (!server) {
    const expressApp = express();

    const app = await NestFactory.create(
      AppModule,
      new ExpressAdapter(expressApp),
    );

    app.enableCors();

    app.setGlobalPrefix("api");

    await app.init();

    server = serverlessExpress({
      app: expressApp,
    });
  }

  return server;
}

export default async function handler(req: any, res: any) {
  const serverInstance = await bootstrap();
  return serverInstance(req, res);
}