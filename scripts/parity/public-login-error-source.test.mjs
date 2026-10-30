import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(new URL('../../apps/web/package.json', import.meta.url));
const ts = require('typescript');
const helper = new URL('../../apps/web/src/features/auth/utils/publicLoginError.ts', import.meta.url);
const modal = new URL('../../apps/web/src/features/auth/components/AuthModal.tsx', import.meta.url);

function loadHelper() {
  const source = readFileSync(helper, 'utf8');
  const module = { exports: {} };
  new Function('module', 'exports', ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText)(module, module.exports);
  return module.exports.legacyLoginErrorMessage;
}

test('Legacy Header smart-login error classes keep the original exact Arabic guidance', () => {
  const translate = loadHelper();
  assert.equal(translate('Too many login attempts'), 'توقف الدخول مؤقتًا لحماية حسابك. انتظر 15 دقيقة، أو اضغط «نسيت كلمة المرور» لاستعادة الدخول.');
  assert.equal(translate('تم تجاوز عدد المحاولات'), 'توقف الدخول مؤقتًا لحماية حسابك. انتظر 15 دقيقة، أو اضغط «نسيت كلمة المرور» لاستعادة الدخول.');
  assert.equal(translate('Too many authentication attempts'), 'محاولات دخول كثيرة من هذه الشبكة. انتظر قليلًا، أو استخدم «نسيت كلمة المرور» إذا نسيتها.');
  assert.equal(translate('Invalid credentials'), 'بيانات الدخول غير صحيحة. راجعها، وإذا نسيت كلمة المرور اضغط «نسيت كلمة المرور» بدل تكرار المحاولات.');
  assert.equal(translate('Invalid email or password'), 'بيانات الدخول غير صحيحة. راجعها، وإذا نسيت كلمة المرور اضغط «نسيت كلمة المرور» بدل تكرار المحاولات.');
  assert.equal(translate('رقم الهوية أو كلمة المرور غير صحيحة'), 'بيانات الدخول غير صحيحة. راجعها، وإذا نسيت كلمة المرور اضغط «نسيت كلمة المرور» بدل تكرار المحاولات.');
  assert.equal(translate('الجوال أو كلمة المرور غير صحيحة'), 'بيانات الدخول غير صحيحة. راجعها، وإذا نسيت كلمة المرور اضغط «نسيت كلمة المرور» بدل تكرار المحاولات.');
  assert.equal(translate('تعذر الاتصال بالخادم'), 'تعذر الاتصال بالخادم', 'unknown failures must retain the original message');
  assert.equal(translate('too MANY LOGIN attempts'), 'توقف الدخول مؤقتًا لحماية حسابك. انتظر 15 دقيقة، أو اضغط «نسيت كلمة المرور» لاستعادة الدخول.');
});

test('public login calls the source error mapper only in the smart-login catch', () => {
  const source = readFileSync(modal, 'utf8');
  assert.match(source, /import\s*\{\s*legacyLoginErrorMessage\s*\}\s*from\s*['"]\.\.\/utils\/publicLoginError['"]/);
  assert.match(source, /catch\s*\(error\)\s*\{\s*setAuthError\(legacyLoginErrorMessage\(error instanceof Error \? error\.message : 'حدث خطأ أثناء تسجيل الدخول'\)\)/);
  assert.match(source, /catch\s*\(error\)\s*\{\s*setAuthError\(error instanceof Error \? error\.message : 'حدث خطأ أثناء إنشاء الحساب'\)/, 'signup must retain its independent source error handling');
});
