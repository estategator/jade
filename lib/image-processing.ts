import 'server-only';
import sharp from 'sharp';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { openai } from '@/lib/openai';
const MAX_RETRIES = 3;
const INITIAL_BACKOFF_MS = 1000;

/** Retry an OpenAI call with exponential backoff on 429 (rate-limit) errors. */
async function withRetry<T>(fn: () => Promise<T>): Promise<T> {
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      return await fn();
    } catch (err) {
      const status = (err as { status?: number })?.status;
      if (status !== 429 || attempt === MAX_RETRIES) throw err;
      const delay = INITIAL_BACKOFF_MS * 2 ** attempt;
      console.warn(`[withRetry] 429 rate-limited, retrying in ${delay}ms (attempt ${attempt + 1}/${MAX_RETRIES})`);
      await new Promise((r) => setTimeout(r, delay));
    }
  }
  throw new Error('withRetry: unreachable');
}

export type AIAnalysisResult = {
  name: string;
  description: string;
  category: string;
  condition: string;
  price: number;
};

export type PricePerCondition = {
  excellent: number;
  good: number;
  fair: number;
  poor: number;
};

export type PricingAnalysisResult = {
  name: string;
  description: string;
  category: string;
  pricePerCondition: PricePerCondition;
};

// Re-exported from app/inventory/actions.ts for client use.
// Keep both definitions in sync.

const VALID_CATEGORIES = [
  'Furniture', 'Art', 'Jewelry', 'Electronics', 'Antiques',
  'Collectibles', 'Clothing', 'Books', 'Kitchenware', 'Tools', 'Other',
];
const VALID_CONDITIONS = ['Excellent', 'Good', 'Fair', 'Poor'];

/** Map free-text condition notes (from the prompt) to the closest valid condition value. */
function inferCondition(raw: unknown): string {
  if (typeof raw !== 'string' || !raw) return 'Good';
  const lower = raw.toLowerCase();
  if (lower.includes('excellent') || lower.includes('mint') || lower.includes('pristine')) return 'Excellent';
  if (lower.includes('poor') || lower.includes('damaged') || lower.includes('broken')) return 'Poor';
  if (lower.includes('fair') || lower.includes('worn') || lower.includes('used')) return 'Fair';
  // Check if the value is already one of the valid conditions (case-insensitive)
  const matched = VALID_CONDITIONS.find((c) => c.toLowerCase() === lower.trim());
  return matched ?? 'Good';
}

const MOCK_NAMES = [
  'Vintage Oak Side Table', 'Brass Desk Lamp', 'Ceramic Flower Vase',
  'Leather Bound Journal', 'Antique Wall Clock', 'Cast Iron Skillet',
  'Handmade Quilt', 'Silver Tea Set', 'Wooden Rocking Chair', 'Crystal Decanter',
];

function generateMockAnalysis(): AIAnalysisResult {
  const name = MOCK_NAMES[Math.floor(Math.random() * MOCK_NAMES.length)];
  const category = VALID_CATEGORIES[Math.floor(Math.random() * (VALID_CATEGORIES.length - 1))];
  const condition = VALID_CONDITIONS[Math.floor(Math.random() * VALID_CONDITIONS.length)];
  const price = Math.round((Math.random() * 500 + 5) * 100) / 100;
  return {
    name,
    description: `A ${condition.toLowerCase()} condition ${category.toLowerCase()} item. ${name} suitable for estate sale listing.`,
    category,
    condition,
    price,
  };
}

function generateMockPricingAnalysis(): PricingAnalysisResult {
  const name = MOCK_NAMES[Math.floor(Math.random() * MOCK_NAMES.length)];
  const category = VALID_CATEGORIES[Math.floor(Math.random() * (VALID_CATEGORIES.length - 1))];
  const basePrice = Math.round((Math.random() * 500 + 20) * 100) / 100;

  return {
    name,
    description: `A versatile ${category.toLowerCase()} item. ${name} suitable for various estate sale price points.`,
    category,
    pricePerCondition: {
      excellent: Math.round(basePrice * 1.5 * 100) / 100,
      good: basePrice,
      fair: Math.round(basePrice * 0.65 * 100) / 100,
      poor: Math.round(basePrice * 0.35 * 100) / 100,
    },
  };
}

export async function analyzeImage(base64Image: string): Promise<AIAnalysisResult | null> {
  if (process.env.AI_NOT_AVAILABLE_FOR_TESTING === 'true') {
    await new Promise((r) => setTimeout(r, 500));
    return generateMockAnalysis();
  }

  const promptId = process.env.OPENAI_ITEM_ANALYSIS_PROMPT_ID;
  const promptVersion = process.env.OPENAI_ITEM_ANALYSIS_PROMPT_VERSION;
  if (!promptId) return null;

  try {
    const response = await withRetry(() => openai.responses.create({
      model: 'gpt-5.4-nano',
      prompt: {
        id: promptId,
        version: promptVersion,
      },
      input: [
        {
          role: 'user',
          content: [
            { type: 'input_image', image_url: base64Image, detail: 'low' },
          ],
        },
      ],
    }));

    const content = response.output_text ?? '';
    console.log('[analyzeImage] raw output_text:', content.slice(0, 500));
    const cleaned = content.replace(/```json?\s*/gi, '').replace(/```/g, '').trim();
    const raw = JSON.parse(cleaned);
    console.log('[analyzeImage] parsed JSON keys:', Object.keys(raw));

    let parsed: AIAnalysisResult;

    // New schema: { sale_summary, identified_items[] }
    if (Array.isArray(raw.identified_items) && raw.identified_items.length > 0) {
      const item = raw.identified_items[0];
      const pricing = item.pricing_strategy;
      console.log('[analyzeImage] new schema detected, item keys:', Object.keys(item));

      parsed = {
        name: item.item_name ?? '',
        description: item.description ?? '',
        category: item.category ?? 'Other',
        condition: inferCondition(item.appraisal_notes?.condition ?? item.condition),
        price: pricing?.suggested_day_1_estate_price ?? pricing?.fair_market_value_retail ?? 0,
      };
    } else {
      // Legacy schema: { primary_object, pricing_strategy } or flat
      const primary = raw.primary_object ?? raw;
      const pricing = raw.pricing_strategy;
      console.log('[analyzeImage] legacy/flat schema, primary keys:', Object.keys(primary));

      parsed = {
        name: primary.name ?? raw.name ?? '',
        description: primary.description ?? raw.description ?? '',
        category: primary.category ?? raw.category ?? 'Other',
        condition: inferCondition(primary.condition_notes ?? primary.condition ?? raw.condition),
        price: pricing?.suggested_estate_price ?? pricing?.fair_market_value ?? raw.price ?? 0,
      };
    }

    if (!VALID_CATEGORIES.includes(parsed.category)) parsed.category = 'Other';
    if (!VALID_CONDITIONS.includes(parsed.condition)) parsed.condition = 'Good';
    if (typeof parsed.price !== 'number' || parsed.price < 0) parsed.price = 0;

    console.log('[analyzeImage] final result:', JSON.stringify(parsed));
    return parsed;
  } catch (err) {
    console.error('[analyzeImage] AI analysis error:', err);
    return null;
  }
}

export async function analyzePricingPerCondition(base64Image: string): Promise<PricingAnalysisResult | null> {
  if (process.env.AI_NOT_AVAILABLE_FOR_TESTING === 'true') {
    await new Promise((r) => setTimeout(r, 500));
    return generateMockPricingAnalysis();
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;

  try {
    const res = await withRetry(async () => {
      const r = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: 'gpt-4o',
          max_tokens: 512,
          messages: [
            {
              role: 'system',
              content: `You are an expert estate sale appraiser. Analyze the item in the image and return ONLY a JSON object (no markdown, no code fences) with these fields:
- "name": short item name
- "description": 1-2 sentence description
- "category": one of ${JSON.stringify(VALID_CATEGORIES)}
- "pricePerCondition": object with keys "excellent", "good", "fair", "poor" - each a USD price number (0-5000 range for estate items)

Consider realistic price variations by condition: Excellent ~1.5x base, Good = 1x, Fair ~0.65x, Poor ~0.35x of a typical comparable.`,
            },
            {
              role: 'user',
              content: [
                { type: 'image_url', image_url: { url: base64Image, detail: 'low' } },
              ],
            },
          ],
        }),
      });
      if (r.status === 429) {
        const err = new Error('Rate limited') as Error & { status: number };
        err.status = 429;
        throw err;
      }
      return r;
    });

    if (!res.ok) return null;

    const json = await res.json();
    const content: string = json.choices?.[0]?.message?.content ?? '';
    const cleaned = content.replace(/```json?\s*/gi, '').replace(/```/g, '').trim();
    const parsed = JSON.parse(cleaned) as PricingAnalysisResult;

    // Validate
    if (!VALID_CATEGORIES.includes(parsed.category)) parsed.category = 'Other';
    if (!parsed.pricePerCondition || typeof parsed.pricePerCondition !== 'object') {
      return null;
    }

    const prices = parsed.pricePerCondition;
    for (const condition of VALID_CONDITIONS) {
      const key = condition.toLowerCase() as keyof PricePerCondition;
      if (typeof prices[key] !== 'number' || prices[key] < 0) {
        prices[key] = 0;
      }
    }

    return parsed;
  } catch (err) {
    console.error('Pricing analysis error:', err);
    return null;
  }
}

export async function batchAnalyzePricingImages(
  buffers: Buffer[]
): Promise<(PricingAnalysisResult | null)[]> {
  const results = await Promise.all(
    buffers.map(async (buffer) => {
      try {
        const medium = await sharp(buffer)
          .resize(800, 600, { fit: 'inside', withoutEnlargement: true })
          .webp({ quality: 85 })
          .toBuffer();

        const medBase64 = `data:image/webp;base64,${medium.toString('base64')}`;
        return await analyzePricingPerCondition(medBase64);
      } catch (error) {
        console.error('Batch analysis error:', error);
        return null;
      }
    })
  );

  return results;
}

export async function analyzeUploadedSimpleImage(buffer: Buffer): Promise<AIAnalysisResult | null> {
  try {
    const medium = await sharp(buffer)
      .resize(800, 600, { fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 85 })
      .toBuffer();

    const medBase64 = `data:image/webp;base64,${medium.toString('base64')}`;
    return await analyzeImage(medBase64);
  } catch (error) {
    console.error('Analysis resize error:', error);
    return null;
  }
}

// Max dimension for stored source images. Larger uploads are resized to this.
const SOURCE_MAX_DIM = 2400;
const SOURCE_QUALITY = 85;

/**
 * Normalize an uploaded image for source storage.
 * Always converts to WebP for a canonical path (`source.webp`).
 * Resizes only when either dimension exceeds SOURCE_MAX_DIM.
 */
export async function normalizeSourceImage(buffer: Buffer): Promise<Buffer> {
  const meta = await sharp(buffer).metadata();
  const needsResize =
    (meta.width ?? 0) > SOURCE_MAX_DIM || (meta.height ?? 0) > SOURCE_MAX_DIM;

  let pipeline = sharp(buffer);
  if (needsResize) {
    pipeline = pipeline.resize(SOURCE_MAX_DIM, SOURCE_MAX_DIM, {
      fit: 'inside',
      withoutEnlargement: true,
    });
  }
  return pipeline.webp({ quality: SOURCE_QUALITY }).toBuffer();
}

export async function processItemImage(itemId: string, storagePath: string): Promise<void> {
  const startMs = Date.now();
  console.log(`[processItemImage] START item=${itemId} at ${new Date().toISOString()}`);
  try {
    await supabaseAdmin
      .from('inventory_items')
      .update({ processing_status: 'processing' })
      .eq('id', itemId);

    const { data: fileData, error: downloadError } = await supabaseAdmin.storage
      .from('inventory-images')
      .download(storagePath);

    if (downloadError || !fileData) {
      throw new Error(`Download failed: ${downloadError?.message}`);
    }

    const buffer = Buffer.from(await fileData.arrayBuffer());

    const [thumbnail, medium] = await Promise.all([
      sharp(buffer).resize(150, 150, { fit: 'cover' }).webp({ quality: 80 }).toBuffer(),
      sharp(buffer).resize(800, 600, { fit: 'inside', withoutEnlargement: true }).webp({ quality: 85 }).toBuffer(),
    ]);

    const thumbPath = `${itemId}/thumbnail.webp`;
    const medPath = `${itemId}/medium.webp`;

    await Promise.all([
      supabaseAdmin.storage.from('inventory-images').upload(thumbPath, thumbnail, {
        contentType: 'image/webp',
        upsert: true,
      }),
      supabaseAdmin.storage.from('inventory-images').upload(medPath, medium, {
        contentType: 'image/webp',
        upsert: true,
      }),
    ]);

    const thumbUrl = supabaseAdmin.storage.from('inventory-images').getPublicUrl(thumbPath).data.publicUrl;
    const medUrl = supabaseAdmin.storage.from('inventory-images').getPublicUrl(medPath).data.publicUrl;

    // AI analysis using the medium-sized image
    const medBase64 = `data:image/webp;base64,${medium.toString('base64')}`;
    console.log(`[processItemImage] AI call START item=${itemId} at +${Date.now() - startMs}ms`);
    const aiResult = await analyzeImage(medBase64);
    console.log(`[processItemImage] AI call END item=${itemId} at +${Date.now() - startMs}ms`);

    // Hydrate primary item fields from AI output when still at defaults
    const fieldUpdates: Record<string, unknown> = {
      thumbnail_url: thumbUrl,
      medium_image_url: medUrl,
      ai_insights: aiResult,
      processing_status: 'complete',
    };

    console.log(`AI analysis for item ${itemId}:`, aiResult);

    if (aiResult) {
      const { data: current } = await supabaseAdmin
        .from('inventory_items')
        .select('name, description, category, condition, price')
        .eq('id', itemId)
        .single();

      if (current) {
        if (!current.name && aiResult.name) fieldUpdates.name = aiResult.name;
        if (!current.description && aiResult.description) fieldUpdates.description = aiResult.description;
        if (current.category === 'Other' && aiResult.category) fieldUpdates.category = aiResult.category;
        if (current.condition === 'Good' && aiResult.condition) fieldUpdates.condition = aiResult.condition;
        if ((!current.price || current.price === 0) && aiResult.price) fieldUpdates.price = aiResult.price;
      }
    }

    await supabaseAdmin
      .from('inventory_items')
      .update(fieldUpdates)
      .eq('id', itemId);

    console.log(`[processItemImage] DONE item=${itemId} total=${Date.now() - startMs}ms`);
  } catch (err) {
    console.error(`[processItemImage] FAILED item=${itemId} at +${Date.now() - startMs}ms:`, err);
    await supabaseAdmin
      .from('inventory_items')
      .update({ processing_status: 'failed' })
      .eq('id', itemId);
  }
}
