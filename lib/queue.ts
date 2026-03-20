import 'server-only';

export async function enqueue<T>(
  queueUrl: string,
  payload: T,
  processInline: (data: T) => Promise<void>,
): Promise<void> {
  // In local dev (no VERCEL env), process inline
  if (!process.env.VERCEL) {
    await processInline(payload);
    return;
  }

  const qstashToken = process.env.QSTASH_TOKEN;
  if (!qstashToken) {
    console.warn('QSTASH_TOKEN not set — processing inline');
    await processInline(payload);
    return;
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://localhost:3000';
  const destination = `${appUrl}${queueUrl}`;

  const res = await fetch('https://qstash.upstash.io/v2/publish/' + destination, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${qstashToken}`,
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const text = await res.text();
    console.error('QStash enqueue failed:', res.status, text);
    // Fallback to inline processing so we don't drop the event
    await processInline(payload);
  }
}
