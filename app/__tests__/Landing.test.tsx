import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import LandingPage from '../Landing';

// Mock framer-motion hooks (must return dummy values for useScroll/useTransform)
vi.mock('framer-motion', async () => {
  const actual = await vi.importActual('framer-motion') as object;
  return {
    ...actual,
    useScroll: () => ({ scrollYProgress: { get: () => 0, onChange: vi.fn() } }),
    useTransform: () => ({ get: () => 0, onChange: vi.fn() }),
  };
});

// Mock external dependencies
vi.mock('@/firebase/client', () => ({
  logAnalyticsEvent: vi.fn(),
}));

vi.mock('@/store', () => ({
  usePopStore: vi.fn(() => false), // showDemo = false by default
}));

// Mock child components to isolate the LandingPage container
vi.mock('@/components/landing/Hero', () => ({ default: () => <div data-testid="mock-hero" /> }));
vi.mock('@/components/landing/Features', () => ({ default: () => <div data-testid="mock-features" /> }));
vi.mock('@/components/landing/Pricing', () => ({ default: () => <div data-testid="mock-pricing" /> }));
vi.mock('@/components/landing/Faq', () => ({ default: () => <div data-testid="mock-faq" /> }));
vi.mock('@/components/landing/Footer', () => ({ default: () => <div data-testid="mock-footer" /> }));
vi.mock('@/components/landing/HomeNavBar', () => ({ default: () => <div data-testid="mock-nav" /> }));
vi.mock('@/components/landing/CoreCapabilities', () => ({ default: () => <div data-testid="mock-capabilities" /> }));
vi.mock('@/components/landing/Proof', () => ({ default: () => <div data-testid="mock-proof" /> }));
vi.mock('@/components/global/ScrollProgressBar', () => ({ default: () => <div data-testid="mock-progress" /> }));
vi.mock('@/components/landing/demo', () => ({ default: () => <div data-testid="mock-demo-modal" /> }));

describe('LandingPage Container', () => {
  it('renders all main sections', () => {
    render(<LandingPage />);
    
    expect(screen.getByTestId('mock-progress')).toBeTruthy();
    expect(screen.getByTestId('mock-nav')).toBeTruthy();
    expect(screen.getByTestId('mock-hero')).toBeTruthy();
    expect(screen.getByTestId('mock-features')).toBeTruthy();
    expect(screen.getByTestId('mock-proof')).toBeTruthy();
    expect(screen.getByTestId('mock-capabilities')).toBeTruthy();
    expect(screen.getByTestId('mock-pricing')).toBeTruthy();
    expect(screen.getByTestId('mock-faq')).toBeTruthy();
    expect(screen.getByTestId('mock-footer')).toBeTruthy();
  });
  
  it('renders skip to main content link for accessibility', () => {
    render(<LandingPage />);
    expect(screen.getByRole('link', { name: /skip to main content/i })).toBeTruthy();
  });
  
  it('renders final CTA section', () => {
    render(<LandingPage />);
    expect(screen.getByRole('heading', { name: /Ready to know your rights/i })).toBeTruthy();
    expect(screen.getByRole('button', { name: /Get Started for Free/i })).toBeTruthy();
  });
});
