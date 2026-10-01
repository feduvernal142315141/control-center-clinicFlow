import type { NextRequest } from 'next/server';
import { proxyToPlatform } from '@/server/bff';

export const dynamic = 'force-dynamic';

type Ctx = { params: Promise<{ path: string[] }> };

async function handler(req: NextRequest, { params }: Ctx) {
  const { path } = await params;
  return proxyToPlatform(req, path);
}

export { handler as GET, handler as POST, handler as PUT, handler as PATCH, handler as DELETE };
