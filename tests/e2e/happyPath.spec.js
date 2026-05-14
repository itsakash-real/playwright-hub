
const { test, expect } = require('@playwright/test');
const { InventoryPage } = require('../../src/pages/InventoryPage');
const { CartPage } = require('../../src/pages/CartPage');
const { CheckoutPage } = require('../../src/pages/CheckoutPage');
const { OrderConfirmPage } = require('../../src/pages/OrderConfirmPage');
const { parseCSVWithTypes } = require('../../src/utils/csvParser');
const { loadFixture } = require('../../src/utils/jsonLoader');
const {
  Severity,
  addStep,
  setupTest,
  captureAndAttach,
  attachJSON,
} = require('../../src/utils/allureHelper');

const products = parseCSVWithTypes('fixtures/products.csv', ['price']);
const { valid: validCheckouts } = loadFixture('fixtures/checkout.json');

test.describe('E2E: Happy Path User Journeys', () => {

  test.beforeEach(async () => {
    await setupTest({
      epic: 'SauceDemo E-Commerce',
      feature: 'End-to-End',
      tags: ['regression', 'e2e'],
    });
  });

  test('should complete full purchase flow with single item', async ({ page }) => {
    await setupTest({
      story: 'Single item purchase',
      severity: Severity.BLOCKER,
      description: 'The primary smoke test. Covers the full user journey: start on inventory → add one item → go to cart → checkout → confirm order. This test must pass for any deployment to be considered healthy.'
    });

    const inventoryPage = new InventoryPage(page);
    const cartPage = new CartPage(page);
    const checkoutPage = new CheckoutPage(page);
    const confirmPage = new OrderConfirmPage(page);

    const targetProduct = products.find((p) => p.name === 'Sauce Labs Backpack');
    const checkoutData = validCheckouts[0];

    // ── Step 1: Start on inventory ───────────────────────────────
    await addStep('Navigate to inventory (already logged in via auth state)', async () => {
      await inventoryPage.navigate();
      const itemCount = await inventoryPage.getItemCount();
      expect(itemCount).toBe(6);
    });

    // ── Step 2: Add item to cart ──────────────────────────────────
    await addStep(`Add "${targetProduct.name}" to cart`, async () => {
      await inventoryPage.addItemToCart(targetProduct.name);
      const cartCount = await inventoryPage.getCartCount();
      expect(cartCount).toBe(1);
    });

    // ── Step 3: Go to cart and verify ────────────────────────────
    await addStep('Navigate to cart and verify item', async () => {
      await inventoryPage.openCart();
      expect(await cartPage.hasItem(targetProduct.name)).toBe(true);
      expect(await cartPage.getItemCount()).toBe(1);
    });

    // ── Step 4: Proceed to checkout ──────────────────────────────
    await addStep('Proceed to checkout step 1', async () => {
      await cartPage.proceedToCheckout();
      expect(page.url()).toContain('checkout-step-one.html');
    });

    // ── Step 5: Fill checkout info ───────────────────────────────
    await addStep('Fill checkout information', async () => {
      await attachJSON('Checkout data', checkoutData);
      await checkoutPage.fillAndContinue(
        checkoutData.firstName,
        checkoutData.lastName,
        checkoutData.zip
      );
      expect(page.url()).toContain('checkout-step-two.html');
    });

    // ── Step 6: Review and finish ────────────────────────────────
    await addStep('Review order and click Finish', async () => {
      const summaryItems = await checkoutPage.getSummaryItemNames();
      expect(summaryItems).toContain(targetProduct.name);

      const subtotal = await checkoutPage.getSubtotal();
      expect(subtotal).toBeCloseTo(targetProduct.price, 2);

      await checkoutPage.clickFinish();
    });

    // ── Step 7: Verify order confirmation ────────────────────────
    await addStep('Verify order confirmation page', async () => {
      expect(confirmPage.isOnConfirmationPage()).toBe(true);

      const header = await confirmPage.getConfirmationHeader();
      expect(header).toBe('Thank you for your order!');

      const isImageVisible = await confirmPage.isSuccessImageVisible();
      expect(isImageVisible).toBe(true);

      // Capture the confirmation page — this is the most valuable screenshot
      // for stakeholders reviewing the test report
      await captureAndAttach(page, 'Order confirmation page');
    });

    // ── Step 8: Return to inventory ──────────────────────────────
    await addStep('Click Back Home to return to inventory', async () => {
      await confirmPage.backToHome();
      expect(page.url()).toContain('inventory.html');

      // Verify the cart is reset after order completion
      const cartCount = await inventoryPage.getCartCount();
      expect(cartCount).toBe(0);
    });
  });

  test('should complete purchase with multiple items and verify total price', async ({ page }) => {
    await setupTest({
      story: 'Multi-item purchase with price check',
      severity: Severity.CRITICAL,
      description: 'Adds multiple items, verifies the subtotal is the sum of individual prices, verifies total = subtotal + tax, and completes the full checkout flow.'
    });

    const inventoryPage = new InventoryPage(page);
    const cartPage = new CartPage(page);
    const checkoutPage = new CheckoutPage(page);
    const confirmPage = new OrderConfirmPage(page);

    // Select two specific products for deterministic price calculation
    const item1 = products.find((p) => p.name === 'Sauce Labs Backpack');   // $29.99
    const item2 = products.find((p) => p.name === 'Sauce Labs Bike Light'); // $9.99
    const expectedSubtotal = item1.price + item2.price;                     // $39.98

    await addStep('Add two items to cart', async () => {
      await inventoryPage.navigate();
      await inventoryPage.addMultipleItemsToCart([item1.name, item2.name]);
      expect(await inventoryPage.getCartCount()).toBe(2);
    });

    await addStep('Verify both items in cart with correct prices', async () => {
      await inventoryPage.openCart();

      const cartPrice1 = await cartPage.getItemPrice(item1.name);
      const cartPrice2 = await cartPage.getItemPrice(item2.name);

      await attachJSON('Price verification', {
        item1: { name: item1.name, expected: item1.price, actual: cartPrice1 },
        item2: { name: item2.name, expected: item2.price, actual: cartPrice2 },
      });

      expect(cartPrice1).toBeCloseTo(item1.price, 2);
      expect(cartPrice2).toBeCloseTo(item2.price, 2);
    });

    await addStep('Proceed through checkout', async () => {
      await cartPage.proceedToCheckout();
      const checkoutData = validCheckouts[0];
      await checkoutPage.fillAndContinue(
        checkoutData.firstName,
        checkoutData.lastName,
        checkoutData.zip
      );
    });

    await addStep('Verify subtotal and total on overview page', async () => {
      const actualSubtotal = await checkoutPage.getSubtotal();
      const tax = await checkoutPage.getTax();
      const total = await checkoutPage.getTotal();

      await attachJSON('Checkout price breakdown', {
        expectedSubtotal,
        actualSubtotal,
        tax,
        total,
        calculatedTotal: actualSubtotal + tax,
      });

      expect(actualSubtotal).toBeCloseTo(expectedSubtotal, 2);
      expect(total).toBeCloseTo(actualSubtotal + tax, 2);
    });

    await addStep('Complete order', async () => {
      await checkoutPage.clickFinish();
      expect(confirmPage.isOnConfirmationPage()).toBe(true);
      const header = await confirmPage.getConfirmationHeader();
      expect(header).toBe('Thank you for your order!');
      await captureAndAttach(page, 'Multiple Items Checkout Confirmation');
    });
  });

  test('should sort products then add cheapest item and complete purchase', async ({ page }) => {
    await setupTest({
      story: 'Sort then purchase',
      severity: Severity.NORMAL,
      description: 'Sorts products by price low-to-high, adds the first (cheapest) item, and completes the full checkout flow. Verifies sort and purchase work together.'
    });

    const inventoryPage = new InventoryPage(page);
    const cartPage = new CartPage(page);
    const checkoutPage = new CheckoutPage(page);
    const confirmPage = new OrderConfirmPage(page);

    let cheapestProduct;

    await addStep('Navigate and sort by price low to high', async () => {
      await inventoryPage.navigate();
      await inventoryPage.sortBy('lohi');
    });

    await addStep('Get the cheapest product (first after sort)', async () => {
      const names = await inventoryPage.getAllItemNames();
      const prices = await inventoryPage.getAllItemPrices();

      cheapestProduct = { name: names[0], price: prices[0] };

      await attachJSON('Cheapest product found', cheapestProduct);

      // Verify it is indeed the cheapest from our fixture data
      const minFixturePrice = Math.min(...products.map((p) => p.price));
      expect(cheapestProduct.price).toBeCloseTo(minFixturePrice, 2);
    });

    await addStep('Add cheapest item to cart', async () => {
      await inventoryPage.addItemToCart(cheapestProduct.name);
      expect(await inventoryPage.getCartCount()).toBe(1);
    });

    await addStep('Complete checkout', async () => {
      await inventoryPage.openCart();
      await cartPage.proceedToCheckout();

      const checkoutData = validCheckouts[0];
      await checkoutPage.fillAndContinue(
        checkoutData.firstName,
        checkoutData.lastName,
        checkoutData.zip
      );

      const subtotal = await checkoutPage.getSubtotal();
      expect(subtotal).toBeCloseTo(cheapestProduct.price, 2);

      await checkoutPage.clickFinish();
    });

    await addStep('Verify order completion', async () => {
      expect(confirmPage.isOnConfirmationPage()).toBe(true);
      const header = await confirmPage.getConfirmationHeader();
      expect(header).toBe('Thank you for your order!');
      await captureAndAttach(page, 'Cheapest Item Checkout Confirmation');
    });
  });
});