import { NextResponse } from 'next/server';
import { analyzeUploadedSimpleImage } from '@/lib/image-processing';

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const imageFile = formData.get('image') as File | null;

    if (!imageFile || imageFile.size === 0) {
      return NextResponse.json({ error: 'No image provided.' }, { status: 400 });
    }

    const buffer = Buffer.from(await imageFile.arrayBuffer());
    const result = await analyzeUploadedSimpleImage(buffer);

    if (!result) {
      return NextResponse.json({ error: 'Could not analyze image.' }, { status: 422 });
    }

    return NextResponse.json({ success: true, data: result });
  } catch (err) {
    console.error('[analyze-route] error:', err);
    return NextResponse.json(
      { error: 'An unexpected error occurred during analysis.' },
      { status: 500 },
    );
  }
}
