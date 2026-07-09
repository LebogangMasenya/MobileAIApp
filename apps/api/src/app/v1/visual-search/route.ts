// Thin Next.js adapter — all logic lives in src/routes/visual-search.ts.
import { handleVisualSearch } from '@/routes/visual-search';

// Platform ceiling well above our own 10s upstream abort budget, so every
// slow search resolves to OUR structured timeout payload, never an opaque
// platform kill (FR-008, research §3).
export const maxDuration = 30;

export async function POST(request: Request): Promise<Response> {
  return handleVisualSearch(request);
}
