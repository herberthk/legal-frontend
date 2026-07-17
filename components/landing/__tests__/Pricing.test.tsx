import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import Pricing from '../Pricing';

describe('Pricing Component', () => {
  it('renders pricing headers', () => {
    render(<Pricing />);
    
    expect(screen.getByText('Simple Pricing')).toBeTruthy();
    expect(screen.getByRole('heading', { level: 2, name: /Start free/i })).toBeTruthy();
  });

  it('renders the free tier blocks', () => {
    render(<Pricing />);
    
    expect(screen.getByText('Welcome Gift')).toBeTruthy();
    expect(screen.getByText('Free Top-Up')).toBeTruthy();
  });

  it('renders pay-as-you-go rates', () => {
    render(<Pricing />);
    
    expect(screen.getByText('Text Chat & Documents')).toBeTruthy();
    expect(screen.getByText('Voice Consultation')).toBeTruthy();
    expect(screen.getByText('What UGX buys you')).toBeTruthy();
  });

  it('changes example token amounts when different UGX buttons are clicked', () => {
    render(<Pricing />);
    
    // The default is activeExample = 1 (5000 UGX)
    const button1000 = screen.getByRole('button', { name: '1,000' });
    const button5000 = screen.getByRole('button', { name: '5,000' });
    const button10000 = screen.getByRole('button', { name: '10,000' });
    
    expect(button1000).toBeTruthy();
    expect(button5000).toBeTruthy();
    expect(button10000).toBeTruthy();
    
    // Click 10,000 button
    fireEvent.click(button10000);
    
    // Check if the text updates to "For UGX 10,000 you get:"
    expect(screen.getByText(/For UGX 10,000 you get/i)).toBeTruthy();
  });
});
