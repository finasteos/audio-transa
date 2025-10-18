import { test, expect } from '@playwright/test';

test('Audio Transcription UI Debug', async ({ page }) => {
  // Navigate to the app
  await page.goto('http://localhost:3000');
  
  // Wait for page to load
  await page.waitForLoadState('domcontentloaded');
  
  // Take initial screenshot
  await page.screenshot({ path: 'debug-screenshot-initial.png', fullPage: true });
  
  // Check for basic elements
  const title = await page.textContent('h1');
  console.log('Page title:', title);
  
  // Look for React/JS errors in console
  const consoleMessages: string[] = [];
  page.on('console', msg => {
    consoleMessages.push(`${msg.type()}: ${msg.text()}`);
  });
  
  // Look for network errors
  const networkErrors: string[] = [];
  page.on('requestfailed', request => {
    networkErrors.push(`Failed: ${request.url()} - ${request.failure()?.errorText}`);
  });
  
  // Wait a bit for any async operations
  await page.waitForTimeout(3000);
  
  // Check if Socket.io connection works
  const connectionStatus = await page.textContent('text=Connected');
  console.log('Connection status element found:', !!connectionStatus);
  
  // Look for the recording button
  const recordButton = await page.locator('button:has-text("Start Recording")').count();
  console.log('Record button found:', recordButton > 0);
  
  // Take final screenshot
  await page.screenshot({ path: 'debug-screenshot-final.png', fullPage: true });
  
  // Report findings
  console.log('\n=== DEBUG REPORT ===');
  console.log('Console messages:', consoleMessages);
  console.log('Network errors:', networkErrors);
  console.log('Page title:', title);
  console.log('Connection status visible:', !!connectionStatus);
  console.log('Record button present:', recordButton > 0);
  
  // Save HTML for inspection
  const html = await page.content();
  require('fs').writeFileSync('debug-page-source.html', html);
  
  console.log('Screenshots saved: debug-screenshot-initial.png, debug-screenshot-final.png');
  console.log('Page source saved: debug-page-source.html');
});