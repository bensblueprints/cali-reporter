import { getDb } from '../../../../lib/db.js';
import { sitemapResponse, sitemapPage } from '../../../../lib/sitemaps.js';
export const dynamic = 'force-dynamic';
export function GET(_request, { params }) { const xml = sitemapPage(getDb(), params.kind, params.file); return xml ? sitemapResponse(xml) : new Response('Not found', { status: 404 }); }
