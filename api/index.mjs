// The hosted API is this one Vercel function (Node.js runtime). vercel.json
// rewrites every /api/* request here, and Node 24 runs the server's
// TypeScript directly, as `node server/main.ts` does on your machine.
import { vercelFunction } from '../server/hosted/vercel-entry.ts';

const serve = vercelFunction(process.env);

export const GET = serve;
export const POST = serve;
