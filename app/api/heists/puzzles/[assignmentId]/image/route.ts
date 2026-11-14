import { getCurrentSession } from '@/src/auth/sessions';
import { getActivePuzzleImage } from '@/src/puzzles/assignment';

export const runtime = 'nodejs';

const uuidPattern = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;

export async function GET(_request: Request,{
  params }: { params: Promise<{ assignmentId: string }>
}) {
  const headers = { 'Cache-Control': 'private, no-store' };
  const session = await getCurrentSession();
  if (!session) return new Response(null, { status: 401, headers });

  const { assignmentId } = await params;
  const image = uuidPattern.test(assignmentId)
    ? await getActivePuzzleImage(session, assignmentId)
    : null;

  if (!image) return new Response(null, { status: 404, headers });

  return new Response(new Uint8Array(image.bytes), {
    headers: {
      ...headers,
      'Content-Type': image.contentType,
      'X-Content-Type-Options': 'nosniff',
    },
  });
}
