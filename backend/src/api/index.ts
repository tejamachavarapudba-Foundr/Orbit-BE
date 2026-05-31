import { bootstrapApp } from '../main';

export default async (req: any, res: any) => {
  const app = await bootstrapApp();
  const server = app.getHttpAdapter().getInstance();
  return server(req, res);
};
