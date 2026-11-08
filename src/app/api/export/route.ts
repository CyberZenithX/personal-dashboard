import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { getSettings } from '@/lib/state';

export const dynamic = 'force-dynamic';

export async function GET() {
  const [settings, tasks, notes, events, voice, xp] = await Promise.all([
    getSettings(),
    query('select * from tasks order by id'),
    query('select * from notes order by id'),
    query('select * from events order by id'),
    query('select * from voice_logs order by id'),
    query('select * from xp_log order by id')
  ]);
  const body = JSON.stringify({ app: 'daylog', exportedAt: new Date().toISOString(), settings, tasks, notes, events, voiceLogs: voice, xpLog: xp }, null, 2);
  return new NextResponse(body, {
    headers: {
      'content-type': 'application/json',
      'content-disposition': `attachment; filename="daylog-export-${new Date().toISOString().slice(0, 10)}.json"`,
      'cache-control': 'no-store'
    }
  });
}
