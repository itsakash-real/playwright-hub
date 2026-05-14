

const { BasePage } = require('./BasePage');


class OrderConfirmPage extends BasePage {
 
  constructor(page) {
    super(page);

    // The main container for the confirmation content
    this.confirmationContainer = page.locator('.checkout_complete_container');

    // The "Thank you for your order!" heading
    this.confirmationHeader = page.locator('.complete-header');

    // The dispatch confirmation text paragraph
    this.confirmationText = page.locator('.complete-text');

    // The checkmark/pony express image
    this.successImage = page.locator('img.pony_express');

    // "Back Home" button → returns to inventory page
    this.backHomeButton = page.locator('[data-test="back-to-products"]');

    // Page title
    this.pageTitle = page.locator('[data-test="title"]');
  }

  async navigate() {
    await super.navigate('/checkout-complete.html');
    await this.confirmationContainer.waitFor({ state: 'visible' });
  }


  async backToHome() {
    await this.backHomeButton.click();
    await this.page.waitForURL('**/inventory.html');
  }

 
  async getConfirmationHeader() {
    const text = await this.confirmationHeader.textContent();
    return text?.trim() ?? '';
  }

  
  async getConfirmationText() {
    const text = await this.confirmationText.textContent();
    return text?.trim() ?? '';
  }

 
  isOnConfirmationPage() {
    return this.getCurrentURL().includes('checkout-complete.html');
  }

 
  async isSuccessImageVisible() {
    return await this.successImage.isVisible();
  }


  async isBackHomeButtonVisible() {
    return await this.backHomeButton.isVisible();
  }

 
  async getPageTitle() {
    const text = await this.pageTitle.textContent();
    return text?.trim() ?? '';
  }
}

module.exports = { OrderConfirmPage };