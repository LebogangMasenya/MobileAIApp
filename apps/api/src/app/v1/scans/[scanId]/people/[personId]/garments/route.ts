// Thin Next.js adapter — all logic lives in src/routes/scans.ts.
import { handleSegmentPerson } from '@/routes/scans';

// Next.js App Router delivers dynamic segments as an awaitable `params`.
export async function POST(
  _request: Request,
  context: { params: Promise<{ scanId: string; personId: string }> },
): Promise<Response> {
  const { scanId, personId } = await context.params;
  return handleSegmentPerson(scanId, personId);
}
