
const { test, expect } = require('@playwright/test');
const { InventoryPage } = require('../../src/pages/InventoryPage');
const { CartPage } = require('../../src/pages/CartPage');
const { CheckoutPage } = require('../../src/pages/CheckoutPage');
const { parseCSVWithTypes } = require('../../src/utils/csvParser');
const { loadFixture } = require('../../src/utils/jsonLoader');
const {
  Severity,
  addStep,
  setSeverity,
  setFeature,
  setStory,
  setEpic,
  attachJSON,
} = require('../../src/utils/allureHelper');

const products = parseCSVWithTypes('fixtures/products.csv', ['price']);
const { valid: validCheckouts, invalid: invalidCheckouts } = loadFixture('fixtures/checkout.json');

test.describe('Checkout: Form Validation & Navigation', () => {

  test.beforeEach(async () => {
    await setFeature('Checkout');
    await setEpic('SauceDemo E-Commerce');
  });

  async function goToCheckoutStepOne(page) {
    const inventoryPage = new InventoryPage(page);
    await inventoryPage.navigate();
    await inventoryPage.addItemToCart(products[0].name);
    await inventoryPage.openCart();
    const cartPage = new CartPage(page);
    await cartPage.proceedToCheckout();
    return new CheckoutPage(page);
  }

  test('should proceed to checkout overview with valid information', async ({ page }) => {
    await setStory('Valid checkout info');
    await setSeverity(Severity.CRITICAL);

    const checkoutPage = await goToCheckoutStepOne(page);
    const validData = validCheckouts[0];

    await addStep('Fill checkout form with valid data', async () => {
      await attachJSON('Checkout fixture used', validData);
      await checkoutPage.fillAndContinue(
        validData.firstName,
        validData.lastName,
        validData.zip
      );
    });

    await addStep('Verify navigation to step 2 (overview)', async () => {
      await expect(page).toHaveURL(/.*checkout-step-two\.html/);
      const title = await checkoutPage.getPageTitle();
      expect(title).toBe('Checkout: Overview');
    });
  });

  for (const scenario of invalidCheckouts) {
    test(`should show validation error: ${scenario.id}`, async ({ page }) => {
      await setStory('Form validation');
      await setSeverity(Severity.NORMAL);

      const checkoutPage = await goToCheckoutStepOne(page);

      await addStep(`Fill form with invalid data: ${scenario.description}`, async () => {
        await attachJSON('Invalid scenario fixture', scenario);
        await checkoutPage.fillInfo(scenario.firstName, scenario.lastName, scenario.zip);
      });

      await addStep('Click Continue', async () => {
        await checkoutPage.clickContinue();
      });

      await addStep('Verify correct error message is shown', async () => {
        const hasError = await checkoutPage.hasError();
        expect(hasError).toBe(true);

        const errorText = await checkoutPage.getErrorMessage();
        expect(errorText).toBe(scenario.expectedError);
      });

      await addStep('Verify we remain on step 1', async () => {
        await expect(page).toHaveURL(/.*checkout-step-one\.html/);
      });
    });
  }

  test('should display correct items in order overview on step 2', async ({ page }) => {
    await setStory('Order summary accuracy');
    await setSeverity(Severity.CRITICAL);

    const targetProduct = products[0];
    const checkoutPage = await goToCheckoutStepOne(page);

    await addStep('Complete step 1 with valid data', async () => {
      const validData = validCheckouts[0];
      await checkoutPage.fillAndContinue(
        validData.firstName,
        validData.lastName,
        validData.zip
      );
    });

    await addStep('Verify product appears in order summary', async () => {
      const summaryNames = await checkoutPage.getSummaryItemNames();
      expect(summaryNames).toContain(targetProduct.name);
    });

    await addStep('Verify subtotal is correct', async () => {
      const subtotal = await checkoutPage.getSubtotal();
      await attachJSON('Price calculation', {
        expectedSubtotal: targetProduct.price,
        actualSubtotal: subtotal,
      });
      expect(subtotal).toBeCloseTo(targetProduct.price, 2);
    });

    await addStep('Verify total = subtotal + tax', async () => {
      const subtotal = await checkoutPage.getSubtotal();
      const tax = await checkoutPage.getTax();
      const total = await checkoutPage.getTotal();
      // Total should equal subtotal + tax (within floating point tolerance)
      expect(total).toBeCloseTo(subtotal + tax, 2);
    });
  });

  test('should return to cart when Cancel is clicked on step 1', async ({ page }) => {
    await setStory('Cancel checkout step 1');
    await setSeverity(Severity.MINOR);

    const checkoutPage = await goToCheckoutStepOne(page);

    await addStep('Click Cancel on step 1', async () => {
      await checkoutPage.cancelOnStepOne();
    });

    await addStep('Verify navigation back to cart', async () => {
      await expect(page).toHaveURL(/.*cart\.html/);
    });
  });

  test('should return to inventory when Cancel is clicked on step 2', async ({ page }) => {
    await setStory('Cancel checkout step 2');
    await setSeverity(Severity.MINOR);

    const checkoutPage = await goToCheckoutStepOne(page);

    await addStep('Complete step 1', async () => {
      const validData = validCheckouts[0];
      await checkoutPage.fillAndContinue(
        validData.firstName,
        validData.lastName,
        validData.zip
      );
    });

    await addStep('Click Cancel on step 2', async () => {
      await checkoutPage.cancelOnStepTwo();
    });

    await addStep('Verify navigation back to inventory', async () => {
      await expect(page).toHaveURL(/.*inventory\.html/);
    });
  });
});