
const { test, expect } = require('@playwright/test');

// Page Objects — the ONLY way we interact with the browser in specs
const { LoginPage } = require('../../src/pages/LoginPage');

// Fixture loaders — test data comes from external files, never hardcoded
const { loadFixture } = require('../../src/utils/jsonLoader');

// Allure helpers — rich reporting metadata
const {
  Severity,
  addStep,
  setSeverity,
  setStory,
  setDescription,
  setupTest,
  attachJSON,
  captureAndAttach,
  addParameter,
} = require('../../src/utils/allureHelper');

const { users, invalidCredentials } = loadFixture('fixtures/users.json');
test.use({ storageState: undefined });

test.describe('Authentication: Login', () => {

  test.beforeEach(async () => {
    await setupTest({
      epic: 'SauceDemo E-Commerce',
      feature: 'Authentication',
      tags: ['regression'],
    });
  });
  test('should login successfully with standard_user', async ({ page }) => {
    await setupTest({
      story: 'Valid login',
      severity: Severity.CRITICAL,
      description: 'Verifies that standard_user can log in with correct credentials and is redirected to the inventory page.'
    });

    const loginPage = new LoginPage(page);

    // Use Allure steps to make the report show exactly what happened
    await addStep('Navigate to login page', async () => {
      await loginPage.navigate();
    });

    await addStep('Enter valid credentials', async () => {
      // Find standard_user from the fixture data
      const user = users.find((u) => u.id === 'standard');
      await attachJSON('Test user fixture', user);
      await loginPage.loginAs(user.username, user.password);
    });

    await addStep('Verify redirect to inventory page', async () => {
      // Wait for the URL to change — this is the success condition
      await page.waitForURL('**/inventory.html', { timeout: 10_000 });
      expect(loginPage.isLoggedIn()).toBe(true);
      // Also verify the URL explicitly for a clear assertion message
      expect(page.url()).toContain('inventory.html');
      await captureAndAttach(page, 'Inventory Page after login');
    });
  });

  test('should show error for locked_out_user', async ({ page }) => {
    await setupTest({
      story: 'Locked account',
      severity: Severity.CRITICAL,
      description: 'Verifies that locked_out_user sees the correct error message and cannot access the inventory page.'
    });

    const loginPage = new LoginPage(page);
    const user = users.find((u) => u.id === 'locked_out');

    await addStep('Navigate to login page', async () => {
      await loginPage.navigate();
    });

    await addStep('Attempt login with locked account', async () => {
      await attachJSON('Test user fixture', user);
      await loginPage.loginAs(user.username, user.password);
    });

    await addStep('Verify error message is shown', async () => {
      // toBeVisible() is Playwright's built-in assertion with auto-retry.
      // It keeps checking until the error appears or the timeout expires.
      await expect(loginPage.errorContainer).toBeVisible();

      const errorText = await loginPage.getErrorMessage();
      expect(errorText).toBe(user.expectedError);
    });

    await addStep('Verify user is NOT redirected to inventory', async () => {
      expect(loginPage.isLoggedIn()).toBe(false);
      expect(page.url()).not.toContain('inventory.html');
      await captureAndAttach(page, 'Login Error');
    });
  });

  test('should login with performance_glitch_user within timeout', async ({ page }) => {
    await setupTest({
      story: 'Performance threshold',
      severity: Severity.NORMAL,
      description: 'Verifies that performance_glitch_user eventually logs in successfully. SauceDemo deliberately adds a 5-second delay for this user. Our 15-second navigation timeout should accommodate this.'
    });

    const loginPage = new LoginPage(page);
    const user = users.find((u) => u.id === 'performance_glitch');

    await addStep('Navigate to login page', async () => {
      await loginPage.navigate();
    });

    // Record the time before login to measure duration
    const startTime = Date.now();

    await addStep('Submit login credentials', async () => {
      await loginPage.loginAs(user.username, user.password);
    });

    await addStep('Wait for inventory page (allows up to 15s for slow login)', async () => {
      // Use a 15 second timeout — SauceDemo adds ~5s delay for this user
      await page.waitForURL('**/inventory.html', { timeout: 15_000 });
      const duration = Date.now() - startTime;
      // Attach timing data to the Allure report for analysis
      await attachJSON('Login timing', { durationMs: duration, user: user.username });
    });

    await addStep('Verify successful login', async () => {
      expect(loginPage.isLoggedIn()).toBe(true);
      await captureAndAttach(page, 'Successful Login after delay');
    });
  });
  // In Allure, each generated test appears as a separate row with its own result.
  for (const credential of invalidCredentials) {
    test(`should show error for invalid login: ${credential.id}`, async ({ page }) => {
      // Use addParameter so the report shows exactly which credential set was tested
      await addParameter('scenario_id', credential.id);
      await addParameter('username', credential.username || '(empty)');
      await addParameter('expected_error', credential.expectedError.substring(0, 50));

      await setStory('Invalid credentials');
      await setSeverity(Severity.NORMAL);
      await setDescription(`Tests invalid login scenario: ${credential.id}`);

      const loginPage = new LoginPage(page);

      await addStep('Navigate to login page', async () => {
        await loginPage.navigate();
      });

      await addStep(`Attempt login with ${credential.id} credentials`, async () => {
        await attachJSON('Invalid credential fixture', credential);
        await loginPage.loginAs(credential.username, credential.password);
      });

      await addStep('Capture page state after failed login attempt', async () => {
        await captureAndAttach(page, 'Page state after failed login');
      });

      await addStep('Verify correct error message', async () => {
        const errorText = await loginPage.getErrorMessage();
        expect(errorText).toBe(credential.expectedError);
      });

      await addStep('Verify user remains on login page', async () => {
        expect(loginPage.isLoggedIn()).toBe(false);
      });
    });
  }
  test('should dismiss error message when X is clicked', async ({ page }) => {
    await setupTest({
      story: 'Error dismissal',
      severity: Severity.MINOR,
      description: 'Verifies the error message X button hides the error container.'
    });

    const loginPage = new LoginPage(page);

    await addStep('Navigate and trigger error', async () => {
      await loginPage.navigate();
      await loginPage.loginAs('', '');
    });

    await addStep('Verify error is visible', async () => {
      await expect(loginPage.errorContainer).toBeVisible();
    });

    await addStep('Dismiss the error message', async () => {
      await loginPage.dismissError();
    });

    await addStep('Verify error is gone', async () => {
      await expect(loginPage.errorContainer).not.toBeVisible();
      await captureAndAttach(page, 'Error dismissed');
    });
  });
});