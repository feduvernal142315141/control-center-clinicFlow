import type { NextRequest } from 'next/server';
import { handleLogin } from '@/server/bff';

export const dynamic = 'force-dynamic';

export function POST(req: NextRequest) {
  return handleLogin(req);
}
