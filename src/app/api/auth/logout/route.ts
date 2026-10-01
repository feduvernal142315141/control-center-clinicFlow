import type { NextRequest } from 'next/server';
import { handleLogout } from '@/server/bff';

export const dynamic = 'force-dynamic';

export function POST(req: NextRequest) {
  return handleLogout(req);
}
