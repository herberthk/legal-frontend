import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import Hero from '../Hero';
import { usePopStore } from '@/store';

// Mock the Zustand store
vi.mock('@/store', () => ({
  usePopStore: vi.fn(),
}));

describe('Hero Component', () => {
  it('renders the main headings and text', () => {
    // Setup mock store implementation for this test
    vi.mocked(usePopStore).mockReturnValue(vi.fn());

    render(<Hero />);

    // Check headings
    expect(screen.getByRole('heading', { level: 1 })).toBeTruthy();
    expect(screen.getByText(/Legal Counsel/i)).toBeTruthy();
    expect(screen.getByText(/Without Barriers/i)).toBeTruthy();
    
    // Check trust badges
    expect(screen.getByText('24/7 Availability')).toBeTruthy();
    expect(screen.getByText('Verified Citations')).toBeTruthy();
    expect(screen.getByText('Voice Enabled')).toBeTruthy();
  });

  it('calls setShowDemo when Watch Demo button is clicked', () => {
    const setShowDemoMock = vi.fn();

    vi.mocked(usePopStore).mockImplementation(() => {
      return setShowDemoMock;
    });

    render(<Hero />);
    
    const demoBtn = screen.getByRole('button', { name: /Watch Demo/i });
    expect(demoBtn).toBeTruthy();
    
    fireEvent.click(demoBtn);
    expect(setShowDemoMock).toHaveBeenCalledWith(true);
  });
});
