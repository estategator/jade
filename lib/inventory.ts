export const INVENTORY_CATEGORIES = [
  'Furniture',
  'Art',
  'Jewelry',
  'Electronics',
  'Antiques',
  'Collectibles',
  'Clothing',
  'Books',
  'Kitchenware',
  'Tools',
  'Other',
] as const;

export const INVENTORY_CONDITIONS = ['Excellent', 'Good', 'Fair', 'Poor'] as const;

export const INVENTORY_PROCESSING_STATUSES = [
  'none',
  'queued',
  'processing',
  'analyzing',
  'complete',
  'failed',
] as const;

export type InventoryCategory = (typeof INVENTORY_CATEGORIES)[number];
export type InventoryCondition = (typeof INVENTORY_CONDITIONS)[number];
export type InventoryProcessingStatus = (typeof INVENTORY_PROCESSING_STATUSES)[number];

export type PricePerCondition = {
  excellent: number;
  good: number;
  fair: number;
  poor: number;
};

export type AIAnalysisResult = {
  name: string;
  description: string;
  category: string;
  condition: string;
  price: number;
  pricePerCondition?: PricePerCondition;
};

export function isInventoryCategory(value: string): value is InventoryCategory {
  return INVENTORY_CATEGORIES.includes(value as InventoryCategory);
}

export function isInventoryCondition(value: string): value is InventoryCondition {
  return INVENTORY_CONDITIONS.includes(value as InventoryCondition);
}