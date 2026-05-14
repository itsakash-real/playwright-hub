

const { BasePage } = require('./BasePage');

class CartPage extends BasePage {
 
  constructor(page) {
    super(page);

    // Cart item container — wraps each product in the cart
    this.cartItems = page.locator('.cart_item');

    // All product names in the cart
    this.cartItemNames = page.locator('.cart_item .inventory_item_name');

    // All product prices in the cart
    this.cartItemPrices = page.locator('.cart_item .inventory_item_price');

    // All quantity labels (always "1" in SauceDemo)
    this.cartItemQuantities = page.locator('.cart_item .cart_quantity');

    // Navigation buttons
    this.continueShoppingButton = page.locator('[data-test="continue-shopping"]');
    this.checkoutButton = page.locator('[data-test="checkout"]');

    // Cart title
    this.pageTitle = page.locator('[data-test="title"]');

    // Cart list container (used to verify the page has loaded)
    this.cartList = page.locator('.cart_list');
  }

  async navigate() {
    await super.navigate('/cart.html');
    await this.cartList.waitFor({ state: 'visible' });
  }


  async removeItem(productName) {
    // Build the slug the same way as InventoryPage._nameToSlug
    const slug = productName.toLowerCase().replace(/\s+/g, '-');
    const removeButton = this.page.locator(`[data-test="remove-${slug}"]`);
    await removeButton.waitFor({ state: 'visible' });
    await removeButton.click();
  }


  async continueShopping() {
    await this.continueShoppingButton.click();
    await this.page.waitForURL('**/inventory.html');
  }

  async proceedToCheckout() {
    await this.checkoutButton.click();
    await this.page.waitForURL('**/checkout-step-one.html');
  }


  async isEmpty() {
    const count = await this.cartItems.count();
    return count === 0;
  }


  async getItemCount() {
    return await this.cartItems.count();
  }

  async getItemNames() {
    const names = await this.cartItemNames.allTextContents();
    return names.map((n) => n.trim());
  }

  async getItemPrices() {
    const priceTexts = await this.cartItemPrices.allTextContents();
    return priceTexts.map((p) => parseFloat(p.replace('$', '').trim()));
  }


  async getItemPrice(productName) {
    // Find the cart_item that contains this product name
    const item = this.page.locator('.cart_item').filter({ hasText: productName });
    const priceText = await item.locator('.inventory_item_price').textContent();
    return parseFloat(priceText?.replace('$', '').trim() ?? '0');
  }

  async hasItem(productName) {
    const item = this.page.locator('.cart_item').filter({ hasText: productName });
    return (await item.count()) > 0;
  }

  async getItemQuantity(productName) {
    const item = this.page.locator('.cart_item').filter({ hasText: productName });
    const qtyText = await item.locator('.cart_quantity').textContent();
    return parseInt(qtyText?.trim() ?? '0', 10);
  }

  async getPageTitle() {
    const text = await this.pageTitle.textContent();
    return text?.trim() ?? '';
  }
}

module.exports = { CartPage };