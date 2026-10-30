import { expect, test } from '@playwright/test';

// Source of truth: almeaacodax/main pages/StaticInfoPage.tsx
// Five public pages, exact Arabic copy, layout and return navigation at RTL widths.
const pages = [
  {
    route: '/about',
    title: 'من نحن',
    subtitle: 'منصة المئة تجمع التعلم، التدريب، والاختبارات في تجربة واحدة للقدرات والتحصيلي.',
    sections: [
      ['مهمتنا', 'نساعد الطالب على فهم مستواه، اختيار المسار المناسب، والتقدم عبر محتوى منظم واختبارات تقيس الأداء بوضوح.'],
      ['ما نقدمه', 'مسارات تعليمية، دورات، اختبارات محاكية، تقارير أداء، ومتابعة ذكية تجعل قرار الدراسة التالي أوضح للطالب وولي الأمر.'],
    ],
  },
  {
    route: '/contact',
    title: 'تواصل معنا',
    subtitle: 'نستقبل استفسارات الدعم، الاشتراكات، والملاحظات من هذه الصفحة.',
    sections: [
      ['الدعم', 'يمكنك التواصل مع فريق المنصة من زر واتساب الظاهر في الصفحات العامة عند تفعيله، أو من خلال حسابك داخل المنصة.'],
      ['طلبات الاشتراك', 'للاشتراكات والدفع، افتح صفحة العضويات أو السلة، ثم اختر طريقة الدفع المناسبة وسيتم تسجيل الطلب للمتابعة.'],
    ],
  },
  {
    route: '/faq',
    title: 'الأسئلة الشائعة',
    subtitle: 'إجابات مختصرة عن أكثر الأسئلة المتكررة حول استخدام المنصة.',
    sections: [
      ['هل أحتاج حسابا للبدء؟', 'يمكنك تصفح الصفحات العامة بدون حساب، أما الاختبارات، التقارير، والدورات الخاصة فتحتاج تسجيل دخول.'],
      ['كيف أتابع طلب الدفع؟', 'بعد إنشاء طلب الدفع يظهر في صفحة طلباتي، ويتم تفعيل الوصول بعد مراجعة الطلب واعتماده من الإدارة.'],
      ['هل تظهر نتائجي تلقائيا؟', 'نعم، بعد إنهاء الاختبار تظهر النتيجة والتحليل حسب البيانات المتاحة في الاختبار والمسار.'],
    ],
  },
  {
    route: '/privacy',
    title: 'سياسة الخصوصية',
    subtitle: 'نوضح هنا نوع البيانات المستخدمة داخل المنصة والغرض منها.',
    sections: [
      ['بيانات الحساب', 'نستخدم بيانات الحساب لتسجيل الدخول، تخصيص المسارات، وحفظ نتائج الطالب وطلباته داخل المنصة.'],
      ['بيانات التعلم', 'تستخدم نتائج الاختبارات والتفاعل مع المحتوى لإظهار التقارير والخطط المقترحة وتحسين تجربة التعلم.'],
      ['الحماية', 'يتم تقييد الصفحات الخاصة خلف تسجيل الدخول، ولا تعرض نتائج الطالب أو طلباته للزوار.'],
    ],
  },
  {
    route: '/terms',
    title: 'الشروط والأحكام',
    subtitle: 'استخدام المنصة يعني الالتزام بهذه الإرشادات العامة.',
    sections: [
      ['استخدام الحساب', 'الحساب مخصص لصاحبه، ويجب استخدامه للوصول إلى المحتوى والاختبارات بطريقة نظامية.'],
      ['المحتوى والاشتراكات', 'الوصول للمحتوى المدفوع أو الخاص يتم حسب الاشتراك أو الموافقة الإدارية على طلب الدفع.'],
      ['التحديثات', 'قد يتم تحديث المحتوى، الأسعار، أو آليات الوصول لتحسين الخدمة وإبقاء التجربة مناسبة للطلاب.'],
    ],
  },
] as const;

for (const width of [390, 820, 1440]) {
  for (const item of pages) {
    test(`Legacy public info parity ${item.route} at ${width}px RTL`, async ({ page }) => {
      await page.setViewportSize({ width, height: 1000 });
      await page.route('**/api/v1/auth/me', route => route.fulfill({ status: 401, contentType: 'application/json', body: '{}' }));
      await page.route('**/api/v1/taxonomy/bootstrap?phase=core', route => route.fulfill({ contentType: 'application/json', body: '{"paths":[],"subjects":[]}' }));
      await page.goto(item.route);
      const content = page.locator('div.mx-auto.max-w-4xl.px-4.py-10[dir="rtl"]');
      await expect(content).toHaveCount(1);
      await expect(content.locator('section.rounded-2xl.border-gray-100.bg-white.p-6')).toHaveCount(1);
      await expect(content.getByRole('heading', { name: item.title, exact: true })).toHaveCount(1);
      await expect(content.getByText(item.subtitle, { exact: true })).toHaveCount(1);
      const articles = content.locator('article');
      await expect(articles).toHaveCount(item.sections.length);
      for (let i = 0; i < item.sections.length; i += 1) {
        await expect(articles.nth(i).getByRole('heading', { name: item.sections[i][0], exact: true })).toHaveCount(1);
        await expect(articles.nth(i).getByText(item.sections[i][1], { exact: true })).toHaveCount(1);
      }
      await page.reload();
      await expect(content.getByRole('heading', { name: item.title, exact: true })).toHaveCount(1);
      await content.getByRole('link', { name: 'العودة للرئيسية', exact: true }).click();
      await expect(page).toHaveURL(/\/$/);
      await page.goBack();
      await expect(page).toHaveURL(new RegExp(`${item.route}$`));
      await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      await content.screenshot({ path: `test-results/public-info-${item.route.slice(1)}-${width}.png` });
    });
  }
}
