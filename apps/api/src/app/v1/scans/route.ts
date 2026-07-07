// Thin Next.js adapter — all logic lives in src/routes/scans.ts so the
// serverless platform stays a swappable detail (see that file's header).
import { handleCreateScan } from '@/routes/scans';

export async function POST(request: Request): Promise<Response> {
  return handleCreateScan(request);
}
