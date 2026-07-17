import { test, expect } from '@playwright/test';

test.describe('Landing Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
  });

  test('has correct page title', async ({ page }) => {
    await expect(page).toHaveTitle(/Legal/i);
  });

  test('renders hero heading', async ({ page }) => {
    const heading = page.getByRole('heading', { name: /Legal Counsel/i });
    await expect(heading).toBeVisible();
    await expect(page.getByText('Without Barriers.')).toBeVisible();
  });

  test('renders navigation links', async ({ page }) => {
    const nav = page.locator('nav');
    await expect(nav).toBeVisible();

    await expect(nav.getByRole('link', { name: /Capabilities/i })).toBeVisible();
    await expect(nav.getByRole('link', { name: /Features/i })).toBeVisible();
    await expect(nav.getByRole('link', { name: /Pricing/i })).toBeVisible();
    await expect(nav.getByRole('link', { name: /FAQ/i })).toBeVisible();
  });

  test('renders "Get started" CTA that links to login', async ({ page }) => {
    const cta = page.locator('nav').getByRole('link', { name: /Get started/i });
    await expect(cta).toBeVisible();
    await expect(cta).toHaveAttribute('href', '/login');
  });

  test('renders "Watch Demo" button', async ({ page }) => {
    const demoBtn = page.getByRole('button', { name: /Watch Demo/i });
    await expect(demoBtn).toBeVisible();
  });

  test('renders hero trust badges', async ({ page }) => {
    await expect(page.getByText('24/7 Availability', { exact: true })).toBeVisible();
    await expect(page.getByText('Verified Citations', { exact: true })).toBeVisible();
    await expect(page.getByText('Voice Enabled', { exact: true })).toBeVisible();
  });

  test('has a skip-to-content link for accessibility', async ({ page }) => {
    const skipLink = page.getByRole('link', { name: /Skip to main content/i });
    await expect(skipLink).toBeAttached();
  });

  test('renders final CTA section', async ({ page }) => {
    const ctaHeading = page.getByRole('heading', { name: /Ready to know your rights/i });
    await expect(ctaHeading).toBeVisible();

    const ctaButton = page.getByRole('button', { name: /Get Started for Free/i });
    await expect(ctaButton).toBeVisible();
  });

  test('theme toggle button is present', async ({ page }) => {
    const themeBtn = page.getByRole('button', { name: /Switch to (light|dark) theme/i });
    await expect(themeBtn).toBeVisible();
  });
});
