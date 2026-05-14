

const { test, expect } = require('@playwright/test');
const { InventoryPage } = require('../../src/pages/InventoryPage');
const { CartPage } = require('../../src/pages/CartPage');
const { parseCSVWithTypes } = require('../../src/utils/csvParser');
const {
  Severity,
  addStep,
  setupTest,
  captureAndAttach,
  attachJSON,
} = require('../../src/utils/allureHelper');

// ── Load Fixtures ──────────────────────────────────────────────────
// Parse the CSV with numeric type casting for price and sort priority columns
const products = parseCSVWithTypes('fixtures/products.csv', [
  'price',
  'sortPriorityAZ',
  'sortPriorityZA',
  'sortPriorityPriceLow',
  'sortPriorityPriceHigh',
]);

test.describe('Inventory: Product Listing & Cart Management', () => {

  test.beforeEach(async () => {
    await setupTest({
      epic: 'SauceDemo E-Commerce',
      feature: 'Inventory',
      tags: ['regression'],
    });
  });

  test('should display all 6 products on inventory page', async ({ page }) => {
    await setupTest({
      story: 'Product listing',
      severity: Severity.CRITICAL,
    });

    const inventoryPage = new InventoryPage(page);

    await addStep('Navigate to inventory page', async () => {
      await inventoryPage.navigate();
    });

    await addStep('Verify 6 products are displayed', async () => {
      const count = await inventoryPage.getItemCount();
      expect(count).toBe(6);
    });

    await addStep('Verify all expected product names are present', async () => {
      const displayedNames = await inventoryPage.getAllItemNames();
      const fixtureNames = products.map((p) => p.name);

      await attachJSON('Expected products', fixtureNames);
      await attachJSON('Displayed products', displayedNames);

      // Every product from our fixture should appear on the page
      for (const expectedName of fixtureNames) {
        expect(displayedNames).toContain(expectedName);
      }
      await captureAndAttach(page, 'Inventory Page Listing');
    });
  });

  test('should display correct prices for all products', async ({ page }) => {
    await setupTest({
      story: 'Product pricing',
      severity: Severity.CRITICAL,
    });

    const inventoryPage = new InventoryPage(page);

    await addStep('Navigate to inventory page', async () => {
      await inventoryPage.navigate();
    });

    await addStep('Verify each product price matches fixture', async () => {
      for (const product of products) {
        const displayedPrice = await inventoryPage.getItemPrice(product.name);
        await attachJSON(`Price check: ${product.name}`, {
          expected: product.price,
          actual: displayedPrice,
        });
        // toBeCloseTo handles floating point precision issues
        // e.g., 29.990000001 ≈ 29.99
        expect(displayedPrice).toBeCloseTo(product.price, 2);
      }
      await captureAndAttach(page, 'Products Prices Verification');
    });
  });

  test('should display products sorted by name A to Z by default', async ({ page }) => {
    await setupTest({
      story: 'Default sort order',
      severity: Severity.NORMAL,
    });

    const inventoryPage = new InventoryPage(page);

    await addStep('Navigate to inventory page', async () => {
      await inventoryPage.navigate();
    });

    await addStep('Verify default sort is az', async () => {
      const selectedSort = await inventoryPage.getSelectedSortOption();
      expect(selectedSort).toBe('az');
    });

    await addStep('Verify product order matches A-Z sort from fixture', async () => {
      const displayedNames = await inventoryPage.getAllItemNames();

      // Build expected order from fixture (sort by sortPriorityAZ ascending)
      const expectedOrder = [...products]
        .sort((a, b) => a.sortPriorityAZ - b.sortPriorityAZ)
        .map((p) => p.name);

      await attachJSON('Expected order (AZ)', expectedOrder);
      await attachJSON('Displayed order', displayedNames);

      expect(displayedNames).toEqual(expectedOrder);
      await captureAndAttach(page, 'Sort Order AZ');
    });
  });

  test('should sort products by name Z to A', async ({ page }) => {
    await setupTest({
      story: 'Sort Z to A',
      severity: Severity.NORMAL,
    });

    const inventoryPage = new InventoryPage(page);

    await addStep('Navigate to inventory page', async () => {
      await inventoryPage.navigate();
    });

    await addStep('Select Z to A sort', async () => {
      await inventoryPage.sortBy('za');
    });

    await addStep('Verify product order matches Z-A fixture data', async () => {
      const displayedNames = await inventoryPage.getAllItemNames();

      const expectedOrder = [...products]
        .sort((a, b) => a.sortPriorityZA - b.sortPriorityZA)
        .map((p) => p.name);

      await attachJSON('Expected order (ZA)', expectedOrder);
      await attachJSON('Displayed order', displayedNames);

      expect(displayedNames).toEqual(expectedOrder);
      await captureAndAttach(page, 'Sort Order ZA');
    });
  });

  test('should sort products by price low to high', async ({ page }) => {
    await setupTest({
      story: 'Sort price ascending',
      severity: Severity.NORMAL,
    });

    const inventoryPage = new InventoryPage(page);

    await addStep('Navigate to inventory page', async () => {
      await inventoryPage.navigate();
    });

    await addStep('Select Price low to high sort', async () => {
      await inventoryPage.sortBy('lohi');
    });

    await addStep('Verify prices are in ascending order', async () => {
      const displayedPrices = await inventoryPage.getAllItemPrices();

      await attachJSON('Displayed prices (should be ascending)', displayedPrices);

      // Verify each price is >= the previous price
      for (let i = 1; i < displayedPrices.length; i++) {
        expect(displayedPrices[i]).toBeGreaterThanOrEqual(displayedPrices[i - 1]);
      }
      await captureAndAttach(page, 'Sort Price Lo-Hi');
    });
  });

  test('should sort products by price high to low', async ({ page }) => {
    await setupTest({
      story: 'Sort price descending',
      severity: Severity.NORMAL,
    });

    const inventoryPage = new InventoryPage(page);

    await addStep('Navigate to inventory page', async () => {
      await inventoryPage.navigate();
    });

    await addStep('Select Price high to low sort', async () => {
      await inventoryPage.sortBy('hilo');
    });

    await addStep('Verify prices are in descending order', async () => {
      const displayedPrices = await inventoryPage.getAllItemPrices();

      await attachJSON('Displayed prices (should be descending)', displayedPrices);

      for (let i = 1; i < displayedPrices.length; i++) {
        expect(displayedPrices[i]).toBeLessThanOrEqual(displayedPrices[i - 1]);
      }
      await captureAndAttach(page, 'Sort Price Hi-Lo');
    });
  });

  test('should add a single item to cart and update badge', async ({ page }) => {
    await setupTest({
      story: 'Add to cart',
      severity: Severity.CRITICAL,
    });

    const inventoryPage = new InventoryPage(page);
    const targetProduct = products[0]; // Sauce Labs Backpack

    await addStep('Navigate to inventory page', async () => {
      await inventoryPage.navigate();
    });

    await addStep('Verify cart starts empty', async () => {
      const count = await inventoryPage.getCartCount();
      expect(count).toBe(0);
    });

    await addStep(`Add "${targetProduct.name}" to cart`, async () => {
      await inventoryPage.addItemToCart(targetProduct.name);
    });

    await addStep('Verify cart badge shows 1', async () => {
      const count = await inventoryPage.getCartCount();
      expect(count).toBe(1);
    });

    await addStep('Verify "Remove" button is now shown for the item', async () => {
      const isInCart = await inventoryPage.isItemInCart(targetProduct.name);
      expect(isInCart).toBe(true);
      await captureAndAttach(page, 'Item added to cart');
    });
  });

  test('should add multiple items and remove one from inventory page', async ({ page }) => {
    await setupTest({
      story: 'Add and remove items',
      severity: Severity.NORMAL,
    });

    const inventoryPage = new InventoryPage(page);
    const [firstProduct, secondProduct] = products;

    await addStep('Navigate to inventory page', async () => {
      await inventoryPage.navigate();
    });

    await addStep('Add two items to cart', async () => {
      await inventoryPage.addItemToCart(firstProduct.name);
      await inventoryPage.addItemToCart(secondProduct.name);
      const count = await inventoryPage.getCartCount();
      expect(count).toBe(2);
    });

    await addStep(`Remove "${firstProduct.name}" from cart`, async () => {
      await inventoryPage.removeItemFromCart(firstProduct.name);
    });

    await addStep('Verify cart badge shows 1', async () => {
      const count = await inventoryPage.getCartCount();
      expect(count).toBe(1);
    });

    await addStep('Verify first item is no longer in cart', async () => {
      const firstStillInCart = await inventoryPage.isItemInCart(firstProduct.name);
      expect(firstStillInCart).toBe(false);
    });

    await addStep('Verify second item remains in cart', async () => {
      const secondStillInCart = await inventoryPage.isItemInCart(secondProduct.name);
      expect(secondStillInCart).toBe(true);
      await captureAndAttach(page, 'Cart updated after removal');
    });
  });
});