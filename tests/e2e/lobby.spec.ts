
import { test, expect } from '@playwright/test';

test('lobby synchronization for multiple players', async ({ browser }) => {
  const hostContext = await browser.newContext();
  const hostPage = await hostContext.newPage();

  // 1. Host creates a room
  await hostPage.goto('http://localhost:3000');
  await hostPage.get_by_placeholder('Your Name').fill('Alice');
  await hostPage.getByRole('button', { name: 'Host Game' }).click();

  // Wait for Room ID
  const roomLabel = hostPage.getByText('Room: ', { exact: false });
  await expect(roomLabel).toContainText(/[A-Z0-9]{5}/, { timeout: 10000 });
  const roomText = await roomLabel.innerText();
  const roomCode = roomText.split(': ')[1];

  // 2. Bob joins
  const bobContext = await browser.newContext();
  const bobPage = await bobContext.newPage();
  await bobPage.goto(`http://localhost:3000/?room=${roomCode}`);
  await bobPage.get_by_placeholder('Your Name').fill('Bob');

  // 3. Verify Alice sees Bob
  await expect(hostPage.getByText('Bob')).toBeVisible({ timeout: 15000 });

  // 4. Verify Bob sees Alice
  await expect(bobPage.getByText('Alice')).toBeVisible({ timeout: 15000 });

  // 5. Charlie joins
  const charlieContext = await browser.newContext();
  const charliePage = await charlieContext.newPage();
  await charliePage.goto(`http://localhost:3000/?room=${roomCode}`);
  await charliePage.get_by_placeholder('Your Name').fill('Charlie');

  // 6. Verify everyone sees everyone
  await expect(hostPage.getByText('Charlie')).toBeVisible({ timeout: 15000 });
  await expect(bobPage.getByText('Charlie')).toBeVisible({ timeout: 15000 });
  await expect(charliePage.getByText('Alice')).toBeVisible({ timeout: 15000 });
  await expect(charliePage.getByText('Bob')).toBeVisible({ timeout: 15000 });

  // 7. Verify Start Game button enabled for host
  await expect(hostPage.getByRole('button', { name: 'Start Game' })).toBeEnabled();
});
