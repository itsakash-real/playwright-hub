
const { test, expect } = require('@playwright/test');
const { InventoryPage } = require('../../src/pages/InventoryPage');
const { CartPage } = require('../../src/pages/CartPage');
const { parseCSVWithTypes } = require('../../src/utils/csvParser');
const {
  Severity,
  addStep,
  setSeverity,
  setFeature,
  setStory,
  setDescription,
  setEpic,
  attachJSON,
} = require('../../src/utils/allureHelper');

const products = parseCSVWithTypes('fixtures/products.csv', ['price']);

test.describe('Cart: Item Management', () => {

  test.beforeEach(async () => {
    await setFeature('Shopping Cart');
    await setEpic('SauceDemo E-Commerce');
  });

  test('should start with an empty cart', async ({ page }) => {
    await setStory('Empty cart state');
    await setSeverity(Severity.NORMAL);

    const inventoryPage = new InventoryPage(page);

    await addStep('Navigate to inventory page', async () => {
      await inventoryPage.navigate();
    });

    await addStep('Open the cart', async () => {
      await inventoryPage.openCart();
    });

    const cartPage = new CartPage(page);

    await addStep('Verify cart is empty', async () => {
      const isEmpty = await cartPage.isEmpty();
      expect(isEmpty).toBe(true);

      const count = await cartPage.getItemCount();
      expect(count).toBe(0);
    });
  });
  test('should display added item with correct name and price in cart', async ({ page }) => {
    await setStory('Cart item details');
    await setSeverity(Severity.CRITICAL);

    const inventoryPage = new InventoryPage(page);
    const targetProduct = products.find((p) => p.name === 'Sauce Labs Backpack');

    await addStep('Add product to cart from inventory', async () => {
      await inventoryPage.navigate();
      await inventoryPage.addItemToCart(targetProduct.name);
      await inventoryPage.openCart();
    });

    const cartPage = new CartPage(page);

    await addStep('Verify item appears in cart', async () => {
      const hasItem = await cartPage.hasItem(targetProduct.name);
      expect(hasItem).toBe(true);
    });

    await addStep('Verify item name is correct', async () => {
      const names = await cartPage.getItemNames();
      expect(names).toContain(targetProduct.name);
    });

    await addStep('Verify item price matches inventory price', async () => {
      const cartPrice = await cartPage.getItemPrice(targetProduct.name);
      await attachJSON('Price comparison', {
        product: targetProduct.name,
        inventoryPrice: targetProduct.price,
        cartPrice,
      });
      expect(cartPrice).toBeCloseTo(targetProduct.price, 2);
    });

    await addStep('Verify item quantity is 1', async () => {
      const qty = await cartPage.getItemQuantity(targetProduct.name);
      expect(qty).toBe(1);
    });
  });

  test('should display all added items when multiple are added', async ({ page }) => {
    await setStory('Multiple cart items');
    await setSeverity(Severity.NORMAL);

    const inventoryPage = new InventoryPage(page);
    const itemsToAdd = products.slice(0, 3); // First 3 products

    await addStep('Add 3 items to cart', async () => {
      await inventoryPage.navigate();
      await inventoryPage.addMultipleItemsToCart(itemsToAdd.map((p) => p.name));
    });

    await addStep('Navigate to cart', async () => {
      await inventoryPage.openCart();
    });

    const cartPage = new CartPage(page);

    await addStep('Verify cart shows 3 items', async () => {
      const count = await cartPage.getItemCount();
      expect(count).toBe(3);
    });

    await addStep('Verify all added item names are in cart', async () => {
      const cartNames = await cartPage.getItemNames();
      await attachJSON('Expected items', itemsToAdd.map((p) => p.name));
      await attachJSON('Cart items', cartNames);
      for (const product of itemsToAdd) {
        expect(cartNames).toContain(product.name);
      }
    });
  });

  test('should remove an item from the cart page', async ({ page }) => {
    await setStory('Remove from cart');
    await setSeverity(Severity.CRITICAL);

    const inventoryPage = new InventoryPage(page);
    const [first, second] = products;

    await addStep('Add 2 items and navigate to cart', async () => {
      await inventoryPage.navigate();
      await inventoryPage.addMultipleItemsToCart([first.name, second.name]);
      await inventoryPage.openCart();
    });

    const cartPage = new CartPage(page);

    await addStep(`Remove "${first.name}" from cart`, async () => {
      await cartPage.removeItem(first.name);
    });

    await addStep('Verify removed item is no longer in cart', async () => {
      const hasRemovedItem = await cartPage.hasItem(first.name);
      expect(hasRemovedItem).toBe(false);
    });

    await addStep('Verify remaining item is still in cart', async () => {
      const hasRemainingItem = await cartPage.hasItem(second.name);
      expect(hasRemainingItem).toBe(true);

      const count = await cartPage.getItemCount();
      expect(count).toBe(1);
    });
  });

  test('should return to inventory when Continue Shopping is clicked', async ({ page }) => {
    await setStory('Continue shopping navigation');
    await setSeverity(Severity.MINOR);

    const inventoryPage = new InventoryPage(page);

    await addStep('Navigate to cart', async () => {
      await inventoryPage.navigate();
      await inventoryPage.openCart();
    });

    const cartPage = new CartPage(page);

    await addStep('Click Continue Shopping', async () => {
      await cartPage.continueShopping();
    });

    await addStep('Verify we are back on inventory page', async () => {
      expect(page.url()).toContain('inventory.html');
      expect(inventoryPage.isOnInventoryPage()).toBe(true);
    });
  });

  test('should navigate to checkout when Checkout button is clicked', async ({ page }) => {
    await setStory('Checkout navigation');
    await setSeverity(Severity.CRITICAL);

    const inventoryPage = new InventoryPage(page);

    await addStep('Add item to cart and navigate to cart', async () => {
      await inventoryPage.navigate();
      await inventoryPage.addItemToCart(products[0].name);
      await inventoryPage.openCart();
    });

    const cartPage = new CartPage(page);

    await addStep('Click Checkout button', async () => {
      await cartPage.proceedToCheckout();
    });

    await addStep('Verify navigation to checkout step 1', async () => {
      expect(page.url()).toContain('checkout-step-one.html');
    });
  });
});