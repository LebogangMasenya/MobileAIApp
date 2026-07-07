// Thin Next.js adapter — all logic lives in src/routes/scans.ts.
import { handleGetMatches } from '@/routes/scans';

// Next.js App Router delivers dynamic segments as an awaitable `params`.
export async function GET(
  _request: Request,
  context: { params: Promise<{ scanId: string; garmentId: string }> },
): Promise<Response> {
  const { scanId, garmentId } = await context.params;
  return handleGetMatches(scanId, garmentId);
}
