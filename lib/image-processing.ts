import 'server-only';
import sharp from 'sharp';
import { supabaseAdmin } from '@/lib/supabase-admin';
import {
  INVENTORY_CATEGORIES,
  INVENTORY_CONDITIONS,
  isInventoryCategory,
  isInventoryCondition,
  type AIAnalysisResult,
} from '@/lib/inventory';
import { openai, ANALYSIS_MODEL } from '@/lib/openai';
import { enqueue, TOPICS } from '@/lib/queue';
import { generateObject } from 'ai';
import { z } from 'zod';
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

/** Map free-text condition notes (from the prompt) to the closest valid condition value. */
function inferCondition(raw: unknown): string {
  if (typeof raw !== 'string' || !raw) return 'Good';
  const lower = raw.toLowerCase();
  if (lower.includes('excellent') || lower.includes('mint') || lower.includes('pristine')) return 'Excellent';
  if (lower.includes('poor') || lower.includes('damaged') || lower.includes('broken')) return 'Poor';
  if (lower.includes('fair') || lower.includes('worn') || lower.includes('used')) return 'Fair';
  // Check if the value is already one of the valid conditions (case-insensitive)
  const matched = INVENTORY_CONDITIONS.find((condition) => condition.toLowerCase() === lower.trim());
  return matched ?? 'Good';
}

const MOCK_NAMES = [
  'Vintage Oak Side Table', 'Brass Desk Lamp', 'Ceramic Flower Vase',
  'Leather Bound Journal', 'Antique Wall Clock', 'Cast Iron Skillet',
  'Handmade Quilt', 'Silver Tea Set', 'Wooden Rocking Chair', 'Crystal Decanter',
];

function generateMockAnalysis(): AIAnalysisResult {
  const name = MOCK_NAMES[Math.floor(Math.random() * MOCK_NAMES.length)];
  const category = INVENTORY_CATEGORIES[Math.floor(Math.random() * (INVENTORY_CATEGORIES.length - 1))];
  const condition = INVENTORY_CONDITIONS[Math.floor(Math.random() * INVENTORY_CONDITIONS.length)];
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
  const category = INVENTORY_CATEGORIES[Math.floor(Math.random() * (INVENTORY_CATEGORIES.length - 1))];
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

const analysisSchema = z.object({
  sale_summary: z.object({
    total_items_identified: z.number(),
    dominant_category: z.string(),
    general_aesthetic: z.string(),
  }),
  identified_items: z.array(z.object({
    item_name: z.string(),
    category: z.string(),
    quantity_and_completeness: z.object({
      count: z.number(),
      is_complete_set: z.boolean(),
      notes: z.string(),
    }),
    description: z.string(),
    appraisal_notes: z.object({
      condition: z.string(),
      authenticity_flags: z.string(),
      logistical_warnings: z.string(),
    }),
    pricing_strategy: z.object({
      currency: z.string(),
      fair_market_value_retail: z.number(),
      suggested_day_1_estate_price: z.number(),
      day_3_liquidation_price: z.number(),
      scrap_or_melt_value: z.number(),
      pricing_justification: z.string(),
    }),
  })),
});

const ANALYSIS_SYSTEM_PROMPT = `Role: You are a Master Estate Sale Appraiser, Antiques Authenticator, and Liquidation Strategist.
Task: Analyze the provided image(s) to identify all high-value, notable, or highly salable objects. You must account for real-world estate sale edge cases, including replicas, incomplete sets, scrap value, and item mobility.
Analysis Requirements & Edge Cases to Consider:
- Authenticity & Provenance: Look for signs of reproductions. Flag items that require physical inspection (e.g., "Check bottom for hallmarks," "Requires jeweler loupe for diamond authenticity").
- Completeness: Is it part of a set? (e.g., A teapot missing its lid loses 80% of its value. A set of 5 dining chairs is worth significantly less than an even set of 6).
- Scrap vs. Aesthetic Value: For jewelry or silver items, determine if the value is in the craftsmanship or just the melt/scrap weight.
- Logistics & "Heavy Furniture Penalty": Massive items (pianos, giant armoires, pool tables) have high Fair Market Value but terrible liquidity. Adjust the "Suggested Estate Price" drastically lower to ensure they are removed from the property.
- Condition Extremes: Differentiate between "Patina" (adds value to antiques) and "Damage" (ruins value).`;

export async function analyzeImage(base64Image: string): Promise<AIAnalysisResult | null> {
  if (process.env.AI_NOT_AVAILABLE_FOR_TESTING === 'true') {
    await new Promise((r) => setTimeout(r, 500));
    return generateMockAnalysis();
  }

  try {
    const dataUriMatch = base64Image.match(/^data:([^;]+);base64,(.+)$/);
    const imageBuffer = Buffer.from(dataUriMatch?.[2] ?? base64Image, 'base64');

    const { object: result } = await withRetry(() => generateObject({
      model: openai(ANALYSIS_MODEL),
      schema: analysisSchema,
      system: ANALYSIS_SYSTEM_PROMPT,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'image', image: imageBuffer },
          ],
        },
      ],
      providerOptions: {
        openai: {
          reasoningEffort: 'low',
        },
      },
    }));

    console.log('[analyzeImage] structured result, items:', result.identified_items.length);

    if (!result.identified_items.length) {
      console.warn('[analyzeImage] No items identified');
      return null;
    }

    const item = result.identified_items[0];
    const pricing = item.pricing_strategy;

    const parsed: AIAnalysisResult = {
      name: item.item_name,
      description: item.description,
      category: item.category,
      condition: inferCondition(item.appraisal_notes.condition),
      price: pricing.suggested_day_1_estate_price ?? pricing.fair_market_value_retail ?? 0,
    };

    if (!isInventoryCategory(parsed.category)) parsed.category = 'Other';
    if (!isInventoryCondition(parsed.condition)) parsed.condition = 'Good';
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

  try {
    const result = await analyzeImage(base64Image);
    if (!result) return null;

    const basePrice = result.price;

    return {
      name: result.name,
      description: result.description,
      category: result.category,
      pricePerCondition: {
        excellent: Math.round(basePrice * 1.5 * 100) / 100,
        good: Math.round(basePrice * 100) / 100,
        fair: Math.round(basePrice * 0.65 * 100) / 100,
        poor: Math.round(basePrice * 0.35 * 100) / 100,
      },
    };
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

export async function processItemImage(
  itemId: string,
  storagePath: string,
  options?: { skipAnalysis?: boolean },
): Promise<void> {
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

    const nextStatus = options?.skipAnalysis ? 'complete' : 'analyzing';

    // Persist derived image URLs and transition to the next processing stage.
    await supabaseAdmin
      .from('inventory_items')
      .update({
        thumbnail_url: thumbUrl,
        medium_image_url: medUrl,
        processing_status: nextStatus,
      })
      .eq('id', itemId);

    if (options?.skipAnalysis) {
      console.log(`[processItemImage] derivatives done item=${itemId} at +${Date.now() - startMs}ms, analysis skipped`);
    } else {
      console.log(`[processItemImage] derivatives done item=${itemId} at +${Date.now() - startMs}ms, enqueueing analysis`);

      await enqueue(
        TOPICS.ANALYZE_IMAGE,
        { itemId },
        async (data) => analyzeItemImage(data.itemId),
      );
    }

    console.log(`[processItemImage] DONE item=${itemId} total=${Date.now() - startMs}ms`);
  } catch (err) {
    console.error(`[processItemImage] FAILED item=${itemId} at +${Date.now() - startMs}ms:`, err);
    await supabaseAdmin
      .from('inventory_items')
      .update({ processing_status: 'failed' })
      .eq('id', itemId);
  }
}

/**
 * Run AI analysis on an inventory item's medium image.
 * Invoked as a separate queued job after image derivatives are generated
 * by processItemImage, enabling concurrent analysis across items.
 */
export async function analyzeItemImage(itemId: string): Promise<void> {
  const startMs = Date.now();
  console.log(`[analyzeItemImage] START item=${itemId} at ${new Date().toISOString()}`);
  try {
    const medPath = `${itemId}/medium.webp`;
    const { data: fileData, error: downloadError } = await supabaseAdmin.storage
      .from('inventory-images')
      .download(medPath);

    if (downloadError || !fileData) {
      throw new Error(`Medium image download failed: ${downloadError?.message}`);
    }

    const medium = Buffer.from(await fileData.arrayBuffer());
    const medBase64 = `data:image/webp;base64,${medium.toString('base64')}`;

    console.log(`[analyzeItemImage] AI call START item=${itemId} at +${Date.now() - startMs}ms`);
    const aiResult = await analyzeImage(medBase64);
    console.log(`[analyzeItemImage] AI call END item=${itemId} at +${Date.now() - startMs}ms`);

    const fieldUpdates: Record<string, unknown> = {
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

    console.log(`[analyzeItemImage] DONE item=${itemId} total=${Date.now() - startMs}ms`);
  } catch (err) {
    console.error(`[analyzeItemImage] FAILED item=${itemId} at +${Date.now() - startMs}ms:`, err);
    await supabaseAdmin
      .from('inventory_items')
      .update({ processing_status: 'failed' })
      .eq('id', itemId);
  }
}
