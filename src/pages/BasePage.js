
class BasePage {
  
  constructor(page) {
    this.page = page;

    // Base URL from environment or fallback
    this.baseURL = process.env.BASE_URL || 'https://www.saucedemo.com';
  }

  async navigate(path = '/') {
    await this.page.goto(`${this.baseURL}${path}`, {
      waitUntil: 'domcontentloaded',
    });
  }

  async getTitle() {
    return await this.page.title();
  }

  getCurrentURL() {
    return this.page.url();
  }

  async waitForURL(urlPattern, timeout = 10000) {
    await this.page.waitForURL(urlPattern, { timeout });
  }

  async takeScreenshot(name = 'screenshot') {
    return await this.page.screenshot({
      path: `test-results/${name}-${Date.now()}.png`,
      fullPage: true,
    });
  }

  async waitForNetworkIdle(timeout = 5000) {
    await this.page.waitForLoadState('networkidle', { timeout });
  }

  async isVisible(selector) {
    try {
      const locator = this.page.locator(selector);

      const count = await locator.count();

      if (count === 0) {
        return false;
      }

      return await locator.first().isVisible();
    } catch (error) {
      return false;
    }
  }

  async scrollToElement(selector) {
    await this.page.locator(selector).scrollIntoViewIfNeeded();
  }

  async getText(selector) {
    const text = await this.page.locator(selector).textContent();

    return text?.trim() ?? '';
  }
}

module.exports = { BasePage };