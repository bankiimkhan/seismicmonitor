import { NextRequest } from 'next/server';

export function isAuthorizedCronRequest(req: NextRequest): boolean {
    const secret = process.env.CRON_SECRET;
    if (!secret) return false;

    const authHeader = req.headers.get('authorization') || '';
    return authHeader === `Bearer ${secret}`;
}
