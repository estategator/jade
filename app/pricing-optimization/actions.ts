'use server';

import { normalizeSourceImage, batchAnalyzePricingImages } from '@/lib/image-processing';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { revalidatePath } from 'next/cache';

export type PricingBatchResult = {
  name: string;
  description: string;
  category: string;
  pricePerCondition: { excellent: number; good: number; fair: number; poor: number };
};

const MAX_BATCH_SIZE = 10;
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

export async function processPricingBatch(
  formData: FormData
): Promise<{ data?: PricingBatchResult[]; error?: string }> {
  try {
    const files = formData.getAll('images') as File[];

    if (!files || files.length === 0) {
      return { error: 'No images provided' };
    }

    if (files.length > MAX_BATCH_SIZE) {
      return { error: `Maximum ${MAX_BATCH_SIZE} images allowed per batch` };
    }

    const buffers: Buffer[] = [];
    const validationErrors: string[] = [];

    for (const file of files) {
      if (!file.type.startsWith('image/')) {
        return { error: `${file.name} is not an image file` };
      }
      if (file.size > MAX_FILE_SIZE) {
        return { error: `${file.name} exceeds 10MB size limit` };
      }
    }

    // Normalize all images in parallel
    const normalized = await Promise.all(
      files.map(async (file) => {
        const arrayBuffer = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        return normalizeSourceImage(buffer);
      })
    );
    buffers.push(...normalized);

    // Batch analyze all images
    const results = await batchAnalyzePricingImages(buffers);

    const validResults: PricingBatchResult[] = [];
    const errors: string[] = [];

    for (let i = 0; i < results.length; i++) {
      const result = results[i];
      if (!result) {
        errors.push(`${files[i]?.name ?? `Image ${i + 1}`} analysis failed`);
        continue;
      }

      validResults.push({
        name: result.name,
        description: result.description,
        category: result.category,
        pricePerCondition: result.pricePerCondition,
      });
    }

    if (validResults.length === 0) {
      return { error: errors.join('; ') || 'No images could be analyzed' };
    }

    return { data: validResults };
  } catch (err) {
    console.error('Unexpected error in processPricingBatch:', err);
    return { error: 'An unexpected error occurred while processing images' };
  }
}

export async function addPricingResultToInventory(
  name: string,
  description: string,
  category: string,
  selectedCondition: 'excellent' | 'good' | 'fair' | 'poor',
  pricePerCondition: { excellent: number; good: number; fair: number; poor: number },
  projectId: string,
  userId: string,
  imageFile?: File
): Promise<{ id?: string; error?: string }> {
  try {
    // Validate project ownership
    const { data: project, error: projErr } = await supabaseAdmin
      .from('projects')
      .select('org_id')
      .eq('id', projectId)
      .single();

    if (projErr || !project) {
      return { error: 'Project not found' };
    }

    const { data: membership } = await supabaseAdmin
      .from('org_members')
      .select('org_id')
      .eq('user_id', userId)
      .eq('org_id', project.org_id)
      .single();

    if (!membership) {
      return { error: 'You do not have access to this project' };
    }

    // Condition capitalization for storage
    const conditionLabel = selectedCondition.charAt(0).toUpperCase() + selectedCondition.slice(1);

    // Create inventory item with extended AI insights
    const { data: item, error: itemErr } = await supabaseAdmin
      .from('inventory_items')
      .insert({
        user_id: userId,
        project_id: projectId,
        name,
        description,
        category,
        price: pricePerCondition[selectedCondition],
        condition: conditionLabel,
        status: 'available',
        ai_insights: {
          name,
          description,
          category,
          condition: conditionLabel,
          price: pricePerCondition[selectedCondition],
          pricePerCondition,
        },
      })
      .select('id')
      .single();

    if (itemErr || !item) {
      console.error('Item creation error:', itemErr);
      return { error: 'Failed to create inventory item' };
    }

    // Upload image if provided
    if (imageFile) {
      const arrayBuffer = await imageFile.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      const normalized = await normalizeSourceImage(buffer);

      const sourcePath = `${item.id}/source.webp`;
      const { error: uploadErr } = await supabaseAdmin.storage
        .from('inventory-images')
        .upload(sourcePath, normalized, {
          contentType: 'image/webp',
          upsert: true,
        });

      if (!uploadErr) {
        const sourceUrl = supabaseAdmin.storage.from('inventory-images').getPublicUrl(sourcePath).data.publicUrl;

        await supabaseAdmin
          .from('inventory_items')
          .update({ original_image_url: sourceUrl })
          .eq('id', item.id);
      }
    }

    revalidatePath('/inventory');
    revalidatePath('/pricing-optimization');

    return { id: item.id };
  } catch (err) {
    console.error('Unexpected error in addPricingResultToInventory:', err);
    return { error: 'An unexpected error occurred' };
  }
}
