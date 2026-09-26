import { getDb, CATEGORIES } from '../../lib/db.js';
import { sitemapResponse, pagesSitemap } from '../../lib/sitemaps.js';
export const dynamic = 'force-dynamic';
export function GET() { return sitemapResponse(pagesSitemap(getDb(), CATEGORIES)); }
