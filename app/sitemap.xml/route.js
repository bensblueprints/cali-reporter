import { getDb } from '../../lib/db.js';
import { sitemapResponse, sitemapIndex } from '../../lib/sitemaps.js';
export const dynamic = 'force-dynamic';
export function GET() { return sitemapResponse(sitemapIndex(getDb())); }
