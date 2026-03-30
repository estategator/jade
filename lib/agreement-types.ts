export type AgreementType = 'estate_sale' | 'buyout';

export const AGREEMENT_TYPE_OPTIONS: { value: AgreementType; label: string }[] = [
  { value: 'estate_sale', label: 'Estate Sale' },
  { value: 'buyout', label: 'Buy Out' },
];

export const VALID_AGREEMENT_TYPES = new Set<string>(['estate_sale', 'buyout']);

export const AGREEMENT_TYPE_DEFAULTS: Record<AgreementType, string> = {
  estate_sale: 'Estate Sale Agreement',
  buyout: 'Buy Out Agreement',
};
