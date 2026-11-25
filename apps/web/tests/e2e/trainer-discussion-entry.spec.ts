import { expect, test } from '@playwright/test';

test('trainer dashboard points to real course management and labels demo data', async ({page}) => {
  await page.route(url => url.pathname.startsWith('/api/'), route => {
    const path = new URL(route.request().url()).pathname;
    if (path === '/api/v1/auth/me') return route.fulfill({json:{user:{id:'teacher-1',name:'مدرب تجريبي',email:'teacher@example.invalid',roles:['teacher'],role:'teacher'}}});
    if (path === '/api/v1/taxonomy/bootstrap') return route.fulfill({json:{paths:[],subjects:[],levels:[],skills:[]}});
    return route.fulfill({json:{items:[],ads:[],announcements:[],hasMore:false}});
  });
  await page.goto('/trainer-dashboard',{waitUntil:'domcontentloaded'});
  await expect(page.getByRole('heading',{name:/لوحة مدرب المنصة/})).toContainText('مدرب تجريبي');
  await expect(page.getByRole('status')).toContainText('تجريبية حاليًا');
  await page.getByRole('link',{name:'إدارة الدورات ومناقشات الدروس'}).click();
  await expect(page).toHaveURL(/\/admin-dashboard\/content\?tab=courses/);
  await expect(page.getByRole('heading',{name:'إدارة المحتوى التعليمي'})).toBeVisible();
});

test('trainer courses use scoped API, retry, pagination and open the real editor', async ({page}) => {
  const user={id:'teacher-1',name:'مدرب تجريبي',email:'teacher@example.invalid',roles:['teacher'],role:'teacher'};
  let failing = true;
  const called: string[] = [];
  const course = (id:string,title:string) => ({id,title,pathId:'path-1',subjectId:'subject-1',workflowStatus:'approved',isPublished:true,isVisible:true,revision:1,level:'beginner',presentation:{},skillIds:[]});
  await page.route(url => url.pathname.startsWith('/api/'), route => {
    const url=new URL(route.request().url()), path=url.pathname;
    if (path==='/api/v1/auth/me') return route.fulfill({json:{user}});
    if (path==='/api/v1/taxonomy/bootstrap') return route.fulfill({json:{paths:[{id:'path-1',name:'مسار'}],subjects:[{id:'subject-1',pathId:'path-1',name:'مادة'}],levels:[],skills:[]}});
    if (path==='/api/v1/courses' && route.request().method()==='GET') {
      called.push(url.searchParams.get('page') || '');
      if (failing) return route.fulfill({status:503,json:{message:'تعذر تحميل الدورات'}});
      const pageNumber=Number(url.searchParams.get('page'));
      return route.fulfill({json:{items:[pageNumber===1?course('course-1','دورة حقيقية أولى'):course('course-2','دورة حقيقية ثانية')],page:pageNumber,limit:30,hasMore:pageNumber===1}});
    }
    if (path==='/api/v1/courses/course-2') return route.fulfill({json:{course:course('course-2','دورة حقيقية ثانية')}});
    if (path==='/api/v1/courses/course-2/modules') return route.fulfill({json:{modules:[]}});
    return route.fulfill({json:{items:[],ads:[],announcements:[],hasMore:false}});
  });
  await page.goto('/trainer-dashboard',{waitUntil:'domcontentloaded'});
  await page.getByRole('button',{name:'دوراتي ومساراتي'}).click();
  await expect(page.getByRole('alert')).toContainText('تعذر تحميل الدورات',{timeout:30_000});
  failing = false;
  await page.getByRole('button',{name:'إعادة المحاولة'}).click();
  await expect(page.getByRole('heading',{name:'دورة حقيقية أولى'})).toBeVisible();
  await page.getByRole('button',{name:'التالي',exact:true}).click();
  await expect(page.getByRole('heading',{name:'دورة حقيقية ثانية'})).toBeVisible();
  await expect(page.getByText('دورة حقيقية أولى')).toHaveCount(0);
  await page.getByRole('link',{name:'إدارة الدورة والمناقشات'}).click();
  await expect(page).toHaveURL(/editCourse=course-2/);
  await expect(page.getByRole('heading',{name:/تعديل الدورة/})).toBeVisible();
  expect(called.filter(value => value === '1').length).toBeGreaterThanOrEqual(2);
  expect(called).toContain('2');
});

test('trainer cannot self-approve assessments or questions and only transitions draft to pending_review', async ({ page }) => {
  const user = { id: 'teacher-1', name: 'مدرب تجريبي', email: 'teacher@example.invalid', roles: ['teacher'], role: 'teacher' };
  const workflowStatuses: string[] = [];

  await page.route(url => url.pathname.startsWith('/api/'), async route => {
    const req = route.request();
    const path = new URL(req.url()).pathname;
    if (path === '/api/v1/auth/me') return route.fulfill({ json: { user } });
    if (path === '/api/v1/auth/csrf') return route.fulfill({ json: { csrfToken: 'csrf-1' } });
    if (path === '/api/v1/taxonomy/bootstrap') return route.fulfill({ json: { paths: [], subjects: [], levels: [], skills: [] } });
    if (path === '/api/v1/assessments') {
      return route.fulfill({
        json: {
          items: [
            { id: 'assess-draft-1', code: 'A1', title: 'اختبار مسودة للمدرب', kind: 'normal', workflowStatus: 'draft', totalQuestions: 5 },
            { id: 'assess-app-1', code: 'A2', title: 'اختبار معتمد مسبقاً', kind: 'normal', workflowStatus: 'approved', totalQuestions: 10 },
          ],
          hasMore: false,
        },
      });
    }
    if (path === '/api/v1/assessments/assess-draft-1/workflow' && req.method() === 'POST') {
      const body = req.postDataJSON();
      workflowStatuses.push(body?.status);
      return route.fulfill({ json: { assessment: { id: 'assess-draft-1', workflowStatus: body?.status } } });
    }
    if (path === '/api/v1/questions') {
      return route.fulfill({
        json: {
          items: [
            { id: 'q-draft-1', text: 'سؤال مسودة للمدرب', difficulty: 'medium', revision: 1, workflowStatus: 'draft' },
          ],
          hasMore: false,
        },
      });
    }
    if (path === '/api/v1/questions/q-draft-1/workflow' && req.method() === 'PATCH') {
      const body = req.postDataJSON();
      workflowStatuses.push(body?.status);
      return route.fulfill({ json: { question: { id: 'q-draft-1', workflowStatus: body?.status } } });
    }
    return route.fulfill({ json: { items: [], ads: [], announcements: [], hasMore: false } });
  });

  await page.goto('/trainer-dashboard', { waitUntil: 'domcontentloaded' });
  await page.getByRole('button', { name: 'الاختبارات والتقييمات' }).click();
  await expect(page.getByText('اختبار مسودة للمدرب')).toBeVisible();
  await page.getByRole('button', { name: 'مسودة (إرسال للمراجعة)' }).click();
  await expect(page.getByRole('button', { name: 'قيد المراجعة (سحب)' })).toBeVisible();

  await page.getByRole('button', { name: 'بنك الأسئلة والتمارين' }).click();
  await expect(page.getByText('سؤال مسودة للمدرب')).toBeVisible();
  await page.getByRole('button', { name: 'مسودة (إرسال للمراجعة)' }).click();
  await expect(page.getByRole('button', { name: 'قيد المراجعة (سحب)' })).toBeVisible();

  expect(workflowStatuses).toEqual(['pending_review', 'pending_review']);
});
