

const { BasePage } = require('./BasePage');


class InventoryPage extends BasePage {
  
  constructor(page) {
    super(page);

    // ── Static Selectors ──────────────────────────────────────────
    // Elements that are always present on the inventory page

    // Sort dropdown — controls product ordering
    this.sortDropdown = page.locator('[data-test="product-sort-container"]');

    // Shopping cart link in the header
    this.cartLink = page.locator('[data-test="shopping-cart-link"]');

    // Cart badge — the number shown on the cart icon (only present when cart has items)
    this.cartBadge = page.locator('[data-test="shopping-cart-badge"]');

    // The container holding all product cards
    this.inventoryList = page.locator('.inventory_list');

    // All inventory item containers (there are 6 on SauceDemo)
    this.inventoryItems = page.locator('.inventory_item');

    // All product name elements
    this.itemNames = page.locator('.inventory_item_name');

    // All product price elements
    this.itemPrices = page.locator('.inventory_item_price');

    // Hamburger menu button (top-left)
    this.menuButton = page.locator('#react-burger-menu-btn');

    // The "Products" heading at the top
    this.pageTitle = page.locator('[data-test="title"]');
  }

  async navigate() {
    await super.navigate('/inventory.html');
    await this.inventoryList.waitFor({ state: 'visible' });
  }
  _nameToSlug(productName) {
    return productName.toLowerCase().replace(/\s+/g, '-');
  }


  _getAddToCartButton(productName) {
    const slug = this._nameToSlug(productName);
    return this.page.locator(`[data-test="add-to-cart-${slug}"]`);
  }


  _getRemoveButton(productName) {
    const slug = this._nameToSlug(productName);
    return this.page.locator(`[data-test="remove-${slug}"]`);
  }


  async addItemToCart(productName) {
    const button = this._getAddToCartButton(productName);
    await button.waitFor({ state: 'visible' });
    await button.click();
  }

  
  async removeItemFromCart(productName) {
    const button = this._getRemoveButton(productName);
    await button.waitFor({ state: 'visible' });
    await button.click();
  }

  async addMultipleItemsToCart(productNames) {
    for (const name of productNames) {
      await this.addItemToCart(name);
    }
  }

  async isItemInCart(productName) {
    const removeButton = this._getRemoveButton(productName);
    return await removeButton.isVisible();
  }

  
  async openCart() {
    await this.cartLink.click();
    // Wait for the URL to change to cart.html
    await this.page.waitForURL('**/cart.html');
  }

  async getCartCount() {
    const isVisible = await this.cartBadge.isVisible();
    if (!isVisible) return 0;
    const text = await this.cartBadge.textContent();
    return parseInt(text?.trim() ?? '0', 10);
  }


  async sortBy(sortValue) {
    await this.sortDropdown.selectOption(sortValue);
    
    await this.page.waitForTimeout(300);
  }

 
  async getSelectedSortOption() {
    return await this.sortDropdown.inputValue();
  }

  async getAllItemNames() {
    // allTextContents() returns an array of text for ALL matching elements
    const names = await this.itemNames.allTextContents();
    return names.map((n) => n.trim());
  }


  async getAllItemPrices() {
    const priceTexts = await this.itemPrices.allTextContents();
    return priceTexts.map((p) => parseFloat(p.replace('$', '').trim()));
  }


  async getItemPrice(productName) {
    // Find the inventory_item div that contains this product name
    const itemContainer = this.page
      .locator('.inventory_item')
      .filter({ hasText: productName });

    // Within that container, find the price element
    const priceText = await itemContainer.locator('.inventory_item_price').textContent();
    return parseFloat(priceText?.replace('$', '').trim() ?? '0');
  }

 
  async getItemCount() {
    return await this.inventoryItems.count();
  }


  async getPageTitle() {
    return await this.pageTitle.textContent();
  }

  isOnInventoryPage() {
    return this.getCurrentURL().includes('inventory.html');
  }
}

module.exports = { InventoryPage };