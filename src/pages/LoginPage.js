

const { BasePage } = require('./BasePage');

class LoginPage extends BasePage {
  
  constructor(page) {
    // Call BasePage constructor — sets up this.page and this.baseURL
    super(page);


    this.usernameInput = page.locator('[data-test="username"]');
    this.passwordInput = page.locator('[data-test="password"]');
    this.loginButton = page.locator('[data-test="login-button"]');

    // The error container appears only when login fails.
    // It contains the error message text AND an X button to dismiss it.
    this.errorContainer = page.locator('[data-test="error"]');

    // The X button inside the error message (dismiss button)
    this.errorDismissButton = page.locator('.error-button');

    // The SauceDemo logo text at the top of the page
    this.logoText = page.locator('.login_logo');

    // The "Accepted usernames are:" section in the page body
    // (the hint text listing valid test usernames)
    this.loginCredentialsSection = page.locator('#login_credentials');

    // The password hint section
    this.passwordSection = page.locator('.login_password');
  }

  
  async navigate() {
    await super.navigate('/');
    // Wait for the login button to be visible before returning.
    // This ensures the page is fully loaded before we try to interact with it.
    await this.loginButton.waitFor({ state: 'visible' });
  }


  async fillUsername(username) {
    await this.usernameInput.fill(username);
  }

  async fillPassword(password) {
    await this.passwordInput.fill(password);
  }

 
  async clickLoginButton() {
    await this.loginButton.click();
  }


  async loginAs(username, password) {
    await this.fillUsername(username);
    await this.fillPassword(password);
    await this.clickLoginButton();
  }

 
  async dismissError() {
    await this.errorDismissButton.click();
  }


  isLoggedIn() {
    return this.getCurrentURL().includes('inventory.html');
  }


  async getErrorMessage() {
    // Check if the error container exists and is visible
    const isVisible = await this.errorContainer.isVisible();
    if (!isVisible) return '';
    const text = await this.errorContainer.textContent();
    return text?.trim() ?? '';
  }

  async hasError() {
    return await this.errorContainer.isVisible();
  }

  async getUsernameValue() {
    return await this.usernameInput.inputValue();
  }


  async getPasswordValue() {
    return await this.passwordInput.inputValue();
  }


  async isLoginButtonEnabled() {
    return await this.loginButton.isEnabled();
  }

 
  async getLogoText() {
    return await this.getText('.login_logo');
  }
}

module.exports = { LoginPage };