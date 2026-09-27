import { expect, test, type Page, type Route } from '@playwright/test';

const student = {
  id: 'student-identity-1',
  email: 'student@example.com',
  name: 'طالب المئة',
  status: 'active',
  avatarUrl: '',
  nationalId: '1234567890',
  phone: '966501234567',
  emailVerified: true,
  role: 'student',
  roles: ['student'],
};

function json(route: Route, body: unknown, status = 200) {
  return route.fulfill({
    status,
    contentType: 'application/json',
    body: JSON.stringify(body),
  });
}

async function mockSignedOut(page: Page) {
  await page.route('**/api/v1/auth/me', (route) =>
    json(route, { error: { message: 'unauthenticated' } }, 401),
  );
}

test('desktop login preserves the legacy-shaped modal and authenticates by email', async ({ page }) => {
  await mockSignedOut(page);
  await page.setViewportSize({ width: 1440, height: 1000 });

  let loginBody: Record<string, unknown> = {};
  await page.route('**/api/v1/auth/login', async (route) => {
    loginBody = route.request().postDataJSON() as Record<string, unknown>;
    return json(route, { user: student, csrfToken: 'csrf-login' });
  });

  await page.goto('/login');

  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  await expect(page.getByRole('heading', { name: 'تسجيل الدخول' })).toBeVisible();
  await expect(page.getByText('مرحباً بعودتك! اختر الطريقة الأنسب لك')).toBeVisible();
  await expect(page.getByRole('button', { name: 'الدخول بحساب Google' })).toBeVisible();
  await expect(page.getByText('نسيت كلمة المرور؟')).toBeVisible();

  const identity = page.locator('#smart-login-input');
  const password = page.locator('#smart-login-password');
  await identity.fill('STUDENT@EXAMPLE.COM');
  await password.fill('Password1');

  await page.screenshot({ path: 'test-results/auth-login-desktop.png', fullPage: true });

  await page.locator('#smart-login-submit').click();
  await expect(page).toHaveURL(/\/dashboard$/);
  expect(loginBody).toEqual({ email: 'student@example.com', password: 'Password1' });
});

test('mobile signup keeps the same modal workflow and password rules', async ({ page }) => {
  await mockSignedOut(page);
  await page.setViewportSize({ width: 390, height: 844 });

  let registerBody: Record<string, unknown> = {};
  await page.route('**/api/v1/auth/register', async (route) => {
    registerBody = route.request().postDataJSON() as Record<string, unknown>;
    return json(route, { user: student, csrfToken: 'csrf-register' });
  });

  await page.goto('/signup');

  await expect(page.getByRole('dialog')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'إنشاء حساب جديد' })).toBeVisible();
  await expect(page.getByText('انضم إلى منصة المئة وابدأ رحلة تميزك اليوم')).toBeVisible();

  const form = page.locator('#signup-form');
  await form.getByLabel('Name').fill('طالب المئة');
  await form.getByLabel('Email').fill('STUDENT@EXAMPLE.COM');

  const passwords = form.locator('input[type="password"]');
  await passwords.nth(0).fill('Password1');
  await passwords.nth(1).fill('Password1');

  await expect(form.getByText('✓ 8 أحرف فأكثر')).toBeVisible();
  await expect(form.getByText('✓ حروف وأرقام')).toBeVisible();
  await page.screenshot({ path: 'test-results/auth-signup-mobile.png', fullPage: true });

  await form.getByRole('button', { name: 'إنشاء حساب جديد' }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
  expect(registerBody).toEqual({
    name: 'طالب المئة',
    email: 'student@example.com',
    password: 'Password1',
  });
});

test('phone login exposes WhatsApp OTP progression without external provider access', async ({ page }) => {
  await mockSignedOut(page);
  await page.setViewportSize({ width: 390, height: 844 });

  let startBody: Record<string, unknown> = {};
  let verifyBody: Record<string, unknown> = {};

  await page.route('**/api/v1/auth/whatsapp/start', async (route) => {
    startBody = route.request().postDataJSON() as Record<string, unknown>;
    return json(route, { message: 'sent', expiresInSeconds: 600 });
  });
  await page.route('**/api/v1/auth/whatsapp/verify', async (route) => {
    verifyBody = route.request().postDataJSON() as Record<string, unknown>;
    return json(route, { user: student, csrfToken: 'csrf-wa' });
  });

  await page.goto('/login');
  await page.locator('#smart-login-input').fill('0501234567');
  await expect(page.getByText('✓ رقم جوال')).toBeVisible();

  await page.locator('#smart-otp-send-btn').click();
  await expect(page.getByText(/تم إرسال الرمز على واتساب بنجاح/)).toBeVisible();
  await expect(page.getByText(/صالح 10 دقائق/)).toBeVisible();

  await page.locator('#smart-otp-code').fill('123456');
  await page.screenshot({ path: 'test-results/auth-whatsapp-otp-mobile.png', fullPage: true });

  await page.locator('#smart-otp-verify-btn').click();
  await expect(page).toHaveURL(/\/dashboard$/);
  expect(startBody).toEqual({ phone: '0501234567' });
  expect(verifyBody).toEqual({ phone: '0501234567', code: '123456' });
});

test('login failure stays inside the modal with the generic API error', async ({ page }) => {
  await mockSignedOut(page);
  await page.setViewportSize({ width: 1440, height: 1000 });

  await page.route('**/api/v1/auth/login', (route) =>
    json(route, { error: { message: 'بيانات الدخول غير صحيحة' } }, 401),
  );

  await page.goto('/login');
  await page.locator('#smart-login-input').fill('student@example.com');
  await page.locator('#smart-login-password').fill('WrongPassword1');
  await page.locator('#smart-login-submit').click();

  await expect(page.getByText('بيانات الدخول غير صحيحة')).toBeVisible();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.screenshot({ path: 'test-results/auth-login-error-desktop.png', fullPage: true });
});

test('recovery and verification screens keep token-from-url and manual-token behavior', async ({ page }) => {
  await mockSignedOut(page);

  let forgotBody: Record<string, unknown> = {};
  let resetBody: Record<string, unknown> = {};
  let verifyBody: Record<string, unknown> = {};

  await page.route('**/api/v1/auth/forgot-password', async (route) => {
    forgotBody = route.request().postDataJSON() as Record<string, unknown>;
    return json(route, { message: 'تم إرسال تعليمات الاستعادة إذا كان البريد مسجلا لدينا.' });
  });
  await page.route('**/api/v1/auth/reset-password', async (route) => {
    resetBody = route.request().postDataJSON() as Record<string, unknown>;
    return json(route, { message: 'تم تحديث كلمة المرور. يمكنك تسجيل الدخول الآن.' });
  });
  await page.route('**/api/v1/auth/email/verify', async (route) => {
    verifyBody = route.request().postDataJSON() as Record<string, unknown>;
    return json(route, { user: student, message: 'تم تأكيد البريد بنجاح.' });
  });

  await page.goto('/forgot-password');
  await expect(page.getByRole('heading', { name: 'استعادة كلمة المرور' })).toBeVisible();
  await page.locator('#forgot-email').fill('student@example.com');
  await page.getByRole('button', { name: 'إرسال التعليمات' }).click();
  await expect(page.getByText('تم إرسال تعليمات الاستعادة إذا كان البريد مسجلا لدينا.')).toBeVisible();
  expect(forgotBody).toEqual({ email: 'student@example.com' });

  await page.goto('/reset-password?token=reset-token-123');
  await expect(page.getByRole('heading', { name: 'تعيين كلمة مرور جديدة' })).toBeVisible();
  const resetInputs = page.locator('main input');
  await expect(resetInputs.nth(0)).toHaveValue('reset-token-123');
  await resetInputs.nth(1).fill('NewPassword1');
  await page.getByRole('button', { name: 'حفظ كلمة المرور' }).click();
  await expect(page.getByText('تم تحديث كلمة المرور. يمكنك تسجيل الدخول الآن.')).toBeVisible();
  expect(resetBody).toEqual({ token: 'reset-token-123', password: 'NewPassword1' });

  await page.goto('/verify-email');
  await expect(page.getByRole('heading', { name: 'تأكيد البريد الإلكتروني' })).toBeVisible();
  await page.locator('main input').fill('verify-token-123');
  await page.getByRole('button', { name: 'تأكيد البريد' }).click();
  await expect(page.getByText('تم تأكيد البريد بنجاح.')).toBeVisible();
  expect(verifyBody).toEqual({ token: 'verify-token-123' });

  await page.screenshot({ path: 'test-results/auth-recovery-verification.png', fullPage: true });
});
