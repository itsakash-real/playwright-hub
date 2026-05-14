
const { BasePage } = require('./BasePage');

class CheckoutPage extends BasePage {

  constructor(page) {
    super(page);

    // ── Step 1 Selectors ──────────────────────────────────────────
    this.firstNameInput = page.locator('[data-test="firstName"]');
    this.lastNameInput = page.locator('[data-test="lastName"]');
    this.zipCodeInput = page.locator('[data-test="postalCode"]');

    // Buttons on step 1
    this.continueButton = page.locator('[data-test="continue"]');
    this.cancelButtonStepOne = page.locator('[data-test="cancel"]');

    // Error message on step 1 (validation failure)
    this.errorMessage = page.locator('[data-test="error"]');

    // ── Step 2 Selectors ──────────────────────────────────────────
    // Order summary items (same structure as cart)
    this.summaryItems = page.locator('.cart_item');
    this.summaryItemNames = page.locator('.cart_item .inventory_item_name');
    this.summaryItemPrices = page.locator('.cart_item .inventory_item_price');

    // Price breakdown labels
    this.subtotalLabel = page.locator('[data-test="subtotal-label"]');
    this.taxLabel = page.locator('[data-test="tax-label"]');
    this.totalLabel = page.locator('[data-test="total-label"]');

    // Buttons on step 2
    this.finishButton = page.locator('[data-test="finish"]');
    this.cancelButtonStepTwo = page.locator('[data-test="cancel"]');

    // Page title (changes between steps: "Checkout: Your Information" vs "Checkout: Overview")
    this.pageTitle = page.locator('[data-test="title"]');
  }


  async navigateToStepOne() {
    await super.navigate('/checkout-step-one.html');
    await this.firstNameInput.waitFor({ state: 'visible' });
  }

  async navigateToStepTwo() {
    await super.navigate('/checkout-step-two.html');
    await this.finishButton.waitFor({ state: 'visible' });
  }

  async fillInfo(firstName, lastName, zip) {
    await this.firstNameInput.fill(firstName);
    await this.lastNameInput.fill(lastName);
    await this.zipCodeInput.fill(zip);
  }


  async clickContinue() {
    await this.continueButton.click();
  }

  async fillAndContinue(firstName, lastName, zip) {
    await this.fillInfo(firstName, lastName, zip);
    await this.clickContinue();
  }

  async cancelOnStepOne() {
    await this.cancelButtonStepOne.click();
    await this.page.waitForURL('**/cart.html');
  }

  async clickFinish() {
    await this.finishButton.click();
    await this.page.waitForURL('**/checkout-complete.html');
  }

  async cancelOnStepTwo() {
    await this.cancelButtonStepTwo.click();
    await this.page.waitForURL('**/inventory.html');
  }


  async getErrorMessage() {
    const isVisible = await this.errorMessage.isVisible();
    if (!isVisible) return '';
    const text = await this.errorMessage.textContent();
    return text?.trim() ?? '';
  }

  async hasError() {
    return await this.errorMessage.isVisible();
  }


  async getSubtotal() {
    const text = await this.subtotalLabel.textContent();
    // Extract the number after the dollar sign
    const match = text?.match(/\$(\d+\.\d+)/);
    return match ? parseFloat(match[1]) : 0;
  }


  async getTax() {
    const text = await this.taxLabel.textContent();
    const match = text?.match(/\$(\d+\.\d+)/);
    return match ? parseFloat(match[1]) : 0;
  }


  async getTotal() {
    const text = await this.totalLabel.textContent();
    const match = text?.match(/\$(\d+\.\d+)/);
    return match ? parseFloat(match[1]) : 0;
  }

 
  async getSummaryItemNames() {
    const names = await this.summaryItemNames.allTextContents();
    return names.map((n) => n.trim());
  }

  async getSummaryItemPrices() {
    const priceTexts = await this.summaryItemPrices.allTextContents();
    return priceTexts.map((p) => parseFloat(p.replace('$', '').trim()));
  }


  async getPageTitle() {
    const text = await this.pageTitle.textContent();
    return text?.trim() ?? '';
  }
}

module.exports = { CheckoutPage };