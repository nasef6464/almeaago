import {defineConfig, devices} from '@playwright/test';

const port=process.env.E2E_WEB_PORT || '4173';
if (!/^\d{1,5}$/.test(port) || Number(port)<1 || Number(port)>65535) throw new Error('Invalid E2E_WEB_PORT');
export default defineConfig({
  testDir:'.', timeout:60_000, expect:{timeout:15_000}, retries:0, reporter:'list',
  use:{baseURL:`http://127.0.0.1:${port}`,trace:'retain-on-failure',screenshot:'only-on-failure'},
  projects:[{name:'chromium',use:{...devices['Desktop Chrome'],...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH ? {launchOptions:{executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH}} : {})}}],
  webServer:{command:`npm run dev -- --host 127.0.0.1 --port ${port}`,url:`http://127.0.0.1:${port}`,reuseExistingServer:false,timeout:180_000},
});
