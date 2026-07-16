/**
 * GET /v1/visual-search/images/[id] (specs/008 contracts/search-api.md §2).
 *
 * Exists for exactly one caller: the visual-matching provider, which can only
 * ingest a publicly fetchable URL (research R2). It serves an uploaded
 * isolated-garment PNG from the ephemeral in-memory store — 404 after
 * TTL/eviction or for an unknown id. Ids are 128-bit crypto-random tokens,
 * so "public by construction" never becomes "browsable": there is no listing
 * endpoint and nothing to enumerate.
 *
 * Not a CDN, not storage: `no-store` keeps intermediaries from extending the
 * image's lifetime beyond the TTL the privacy contract promises.
 */

import { getUpload } from '@/services/visualSearch/uploadStore';

export async function GET(
  _request: Request,
  // Next 16 convention (verified against node_modules/next/dist/docs):
  // dynamic params arrive as a Promise and must be awaited.
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id } = await params;
  const upload = getUpload(id);
  if (!upload) {
    // Same envelope dialect as every other failure in this API.
    return new Response(
      JSON.stringify({ error: { code: 'INVALID_INPUT', message: 'Unknown or expired image.' } }),
      { status: 404, headers: { 'content-type': 'application/json' } },
    );
  }
  // Uint8Array → a fresh ArrayBuffer-backed body keeps the BodyInit typing
  // exact regardless of the underlying buffer's byte offset.
  const body = new Uint8Array(upload.bytes).buffer as ArrayBuffer;
  return new Response(body, {
    status: 200,
    headers: {
      'content-type': upload.contentType,
      'cache-control': 'no-store',
      'content-length': String(upload.bytes.byteLength),
    },
  });
}
