/**
 * Vitest setup — stubs modules that depend on server-only packages
 * or Next.js runtime features unavailable in unit tests.
 */
import { vi } from 'vitest';

// Stub 'server-only' so imports don't throw at test time
vi.mock('server-only', () => ({}));
