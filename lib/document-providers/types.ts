/**
 * Document provider abstraction types.
 *
 * Each supported document service (DocuSign, etc.) implements a common
 * connection lifecycle used by settings UI + document signing dispatch.
 */

export type DocumentProvider = 'docusign';

export type DocumentConnectionStatus = 'pending' | 'connected' | 'error' | 'disconnected';

export interface DocumentProviderConnection {
  id: string;
  orgId: string;
  provider: DocumentProvider;
  externalAccountId: string;
  status: DocumentConnectionStatus;
  isDefault: boolean;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface DocumentProviderConnectionStatus {
  provider: DocumentProvider;
  connected: boolean;
  externalAccountId: string | null;
  isDefault: boolean;
}

export interface DocumentProviderDisplayInfo {
  provider: DocumentProvider;
  name: string;
  description: string;
  icon: string;
  brandColor: string;
  darkBrandColor: string;
  dashboardUrl: string | null;
  oauthSupported: boolean;
}

export const DOCUMENT_PROVIDER_DISPLAY: Record<DocumentProvider, DocumentProviderDisplayInfo> = {
  docusign: {
    provider: 'docusign',
    name: 'DocuSign',
    description: 'Send and receive documents and e-signatures through DocuSign.',
    icon: 'FileSignature',
    brandColor: 'text-yellow-600',
    darkBrandColor: 'dark:text-yellow-400',
    dashboardUrl: 'https://app.docusign.com',
    oauthSupported: true,
  },
};

export const ALL_DOCUMENT_PROVIDERS: DocumentProvider[] = ['docusign'];
