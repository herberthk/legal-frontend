import { vi } from 'vitest';

vi.mock('server-only', () => ({}));

class IntersectionObserverMock {
  disconnect = vi.fn();
  observe = vi.fn();
  takeRecords = vi.fn();
  unobserve = vi.fn();
}
vi.stubGlobal('IntersectionObserver', IntersectionObserverMock);

// Mock matchMedia (often missing in jsdom, sometimes required by UI libs)
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation((query) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(), // deprecated
    removeListener: vi.fn(), // deprecated
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

// Provide dummy environment variables so Firebase initialization doesn't throw invalid-api-key errors
process.env.NEXT_PUBLIC_FIREBASE_API_KEY = 'test-api-key';
process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN = 'test-domain.firebaseapp.com';
process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID = 'test-project';
process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET = 'test-bucket.appspot.com';
process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID = '1234567890';
process.env.NEXT_PUBLIC_FIREBASE_APP_ID = '1:1234567890:web:abc123def456';

// Global mock for Firebase Client to bypass initialization entirely
vi.mock('@/firebase/client', () => ({
  logAnalyticsEvent: vi.fn(),
  auth: {},
  db: {},
  storage: {},
}));
