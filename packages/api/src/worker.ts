import app from './server';

export type Env = Record<string, unknown>;

export default {
  async fetch(
    request: Request,
    env: Env,
    ctx: ExecutionContext
  ): Promise<Response> {
    return await app.fetch(request, env, ctx);
  },
};
