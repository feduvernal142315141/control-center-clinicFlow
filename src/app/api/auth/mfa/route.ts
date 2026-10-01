import type { NextRequest } from 'next/server';
import { handleMfaVerify } from '@/server/bff';

export const dynamic = 'force-dynamic';

export function POST(req: NextRequest) {
  return handleMfaVerify(req);
}
