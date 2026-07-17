import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import Features from '../Features';
import { features } from '@/constants';

describe('Features Component', () => {
  it('renders section title and description', () => {
    render(<Features />);
    
    expect(screen.getByText('Why LegalAdviser?')).toBeTruthy();
    expect(screen.getByRole('heading', { level: 3 })).toBeTruthy();
    expect(screen.getByText(/Replace confusion/i)).toBeTruthy();
  });

  it('renders all feature items from constants', () => {
    render(<Features />);
    
    features.forEach(feature => {
      expect(screen.getByText(feature.title)).toBeTruthy();
      expect(screen.getByText(feature.desc)).toBeTruthy();
    });
  });
});
