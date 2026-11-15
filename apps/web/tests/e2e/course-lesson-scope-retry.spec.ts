import { expect, test, type Page, type Route } from '@playwright/test';

// A learner's progress and lesson body must never belong to a different selected lesson.
const student = {
  id: 'student-1', email: 'student@example.com', name: 'طالب',
  status: 'active', avatarUrl: '', emailVerified: true, role: 'student', roles: ['student'],
};
const course = {
  id: 'course-1', pathId:'path-1', subjectId:'sub-1', title: 'دورة اختبار التنقل', description: '', instructorName: '',
  durationMinutes: 20, level: 'beginner', thumbnailAssetId: '', dripContentEnabled: false,
  certificateEnabled: false, access: { allowed: true, configured: true, reason: 'free_product' },
  modules: [{
    id: 'module-1', title: 'الوحدة الأولى', description: '', sortOrder: 1,
    lessons: [
      { id: 'lesson-a', title: 'الدرس الأول', description: '', type: 'text', durationSeconds: 0, isLocked: false, isPreview: false, commerceLocked: false, sortOrder: 1 },
      { id: 'lesson-b', title: 'الدرس الثاني', description: '', type: 'text', durationSeconds: 0, isLocked: false, isPreview: false, commerceLocked: false, sortOrder: 2 },
    ],
  }],
};
const detail = (id: string) => ({
  id, title: id === 'lesson-a' ? 'الدرس الأول' : 'الدرس الثاني',
  description: '', type: 'text', durationSeconds: 0, isLocked: false,
  isPreview: false, commerceLocked: false, sortOrder: id === 'lesson-a' ? 1 : 2,
  contentText: id === 'lesson-a' ? 'نص الدرس الأول الحصري' : 'نص الدرس الثاني الحصري',
  videoUrl: '', videoSource: '',
});
const progress = (id: string, status = 'not_started', positionSeconds = 0) => ({
  lessonId: id, contextType: 'course', courseId: 'course-1', topicId: '',
  status, positionSeconds, completedAt: status === 'completed' ? '2026-10-29T00:00:00Z' : null,
  updatedAt: '2026-10-29T00:00:00Z',
});
function json(route: Route, body: unknown, status = 200) {
  return route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
}
async function setup(page: Page) {
  await page.route('**/api/v1/auth/me', route => json(route, { user: student }));
  await page.route('**/api/v1/auth/csrf', route => json(route, { csrfToken: 'csrf' }));
  await page.route('**/api/v1/assessment-placements/available?*', route => json(route,{items:[],page:1,limit:30,hasMore:false}));
  await page.route('**/api/v1/learning-progress/courses/course-1/completed', route => json(route, {courseId:'course-1',completedLessonIds:[]}));
  await page.route('**/api/v1/learning-spaces/courses/course-1', route => json(route, { course }));
  await page.route('**/api/v1/learning-spaces/courses/course-1/lessons/lesson-a', route => json(route, { lesson: detail('lesson-a') }));
  await page.route('**/api/v1/learning-progress/lessons/*?**', route => {
    const id = new URL(route.request().url()).pathname.split('/').pop() || '';
    return json(route, { progress: progress(id) });
  });
}

for (const width of [390, 820, 1440]) {
  test(`course lesson switch keeps old content hidden, retries failed load and preserves selected lesson after reload at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await setup(page);
    let attempts = 0;
    await page.route('**/api/v1/learning-spaces/courses/course-1/lessons/lesson-b', async route => {
      attempts += 1;
      if (attempts === 1) {
        await new Promise(resolve => setTimeout(resolve, 200));
        return json(route, { message: 'تعذر تحميل الدرس التجريبي' }, 503);
      }
      return json(route, { lesson: detail('lesson-b') });
    });
    const completed: string[] = [];
    let persisted = false;
    await page.route('**/api/v1/learning-progress/lessons/lesson-b?**', route =>
      json(route, { progress: progress('lesson-b', persisted ? 'completed' : 'not_started') }),
    );
    await page.route('**/api/v1/learning-progress/lessons/*/complete', route => {
      completed.push(route.request().url().split('/').at(-2) || '');
      if (completed.length === 1) return json(route, { message: 'تعذر الحفظ مؤقتًا' }, 503);
      persisted = true;
      return json(route, { progress: progress('lesson-b', 'completed') });
    });

    await page.goto('/learning/courses/course-1');
    await expect(page.getByText('نص الدرس الأول الحصري')).toBeVisible();
    if (width < 1024) {
      await page.getByRole('button', { name: 'فتح قائمة الدروس' }).click();
    }
    await page.getByRole('button', { name: /الدرس الثاني/ }).click();
    await expect(page.getByRole('heading', { name: 'الدرس الثاني' })).toBeVisible();
    await expect(page.getByText('نص الدرس الأول الحصري')).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'تحديد كمكتمل' })).toHaveCount(0);
    await expect(page.getByText('تعذر تحميل الدرس التجريبي')).toBeVisible();
    await page.getByRole('button', { name: 'إعادة محاولة تحميل الدرس' }).click();
    await expect(page.getByText('نص الدرس الثاني الحصري')).toBeVisible();
    await expect(page.getByRole('button', { name: 'تحديد كمكتمل' })).toBeEnabled();
    await page.getByRole('button', { name: 'تحديد كمكتمل' }).click();
    await expect(page.getByText('تعذر الحفظ مؤقتًا')).toBeVisible();
    await expect(page.getByRole('button', { name: 'تحديد كمكتمل' })).toBeEnabled();
    await expect(page.getByText('نص الدرس الثاني الحصري')).toBeVisible();
    await page.getByRole('button', { name: 'تحديد كمكتمل' }).click();
    await expect(page.getByText('تم تسجيل الدرس كمكتمل.')).toBeVisible();
    expect(completed).toEqual(['lesson-b', 'lesson-b']);
    await expect(page).toHaveURL(/lesson=lesson-b/);
    await page.screenshot({ path: `test-results/course-lesson-scope-${width}.png`, fullPage: true });
    await page.reload();
    await expect(page.getByText('نص الدرس الثاني الحصري')).toBeVisible();
    await expect(page.getByText('نص الدرس الأول الحصري')).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'تحديد كمكتمل' })).toBeDisabled();
  });
}

test('late video save from the previous lesson cannot replace the newly selected lesson progress', async ({ page }) => {
  await setup(page);
  const video = { ...detail('lesson-a'), type: 'video', durationSeconds: 120, videoUrl: '/media/test.mp4', videoSource: 'upload' };
  await page.route('**/api/v1/learning-spaces/courses/course-1/lessons/lesson-a', route => json(route, { lesson: video }));
  await page.route('**/media/test.mp4', route => route.fulfill({ status: 200, headers: { 'Content-Type': 'video/mp4' }, body: '' }));
  let releaseSave: (() => void) | undefined;
  await page.route('**/api/v1/learning-progress/lessons/lesson-a/video', async route => {
    await new Promise<void>(resolve => { releaseSave = resolve; });
    return json(route, { progress: progress('lesson-a', 'in_progress', 42) });
  });
  await page.route('**/api/v1/learning-spaces/courses/course-1/lessons/lesson-b', route => json(route, { lesson: detail('lesson-b') }));
  await page.goto('/learning/courses/course-1');
  const player = page.getByTestId('lesson-video');
  await expect(player).toBeVisible();
  await player.evaluate(node => {
    Object.defineProperty(node, 'currentTime', { configurable: true, writable: true, value: 42 });
    node.dispatchEvent(new Event('pause'));
  });
  await expect.poll(() => Boolean(releaseSave)).toBe(true);
  await page.getByRole('button', { name: /الدرس الثاني/ }).click();
  await expect(page.getByText('نص الدرس الثاني الحصري')).toBeVisible();
  releaseSave?.();
  await expect(page.getByRole('button', { name: 'تحديد كمكتمل' })).toBeEnabled();
  await expect(page.getByText(/آخر موضع 42 ثانية/)).toHaveCount(0);
  await expect(page.getByText('نص الدرس الأول الحصري')).toHaveCount(0);
});

test('a mismatched progress response is discarded without hiding an authorized lesson', async ({ page }) => {
  await setup(page);
  await page.route('**/api/v1/learning-spaces/courses/course-1/lessons/lesson-b', route => json(route, { lesson: detail('lesson-b') }));
  await page.route('**/api/v1/learning-progress/lessons/lesson-b?**', route =>
    json(route, { progress: progress('lesson-a', 'completed', 42) }),
  );
  await page.goto('/learning/courses/course-1');
  await expect(page.getByText('نص الدرس الأول الحصري')).toBeVisible();
  await page.getByRole('button', { name: /الدرس الثاني/ }).click();
  await expect(page.getByText('نص الدرس الثاني الحصري')).toBeVisible();
  await expect(page.getByText('تعذر التحقق من تقدم هذا الدرس؛ لم تُعرض بيانات درس آخر.')).toBeVisible();
  await expect(page.getByText('مكتمل', { exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'تحديد كمكتمل' })).toBeEnabled();
});

test('course notes remain private to the selected lesson and do not claim instructor delivery', async ({ page }) => {
  test.setTimeout(120_000);
  await setup(page);
  await page.route('**/api/v1/learning-spaces/courses/course-1/lessons/lesson-b', route => json(route, { lesson: detail('lesson-b') }));
  await page.goto('/learning/courses/course-1');
  await page.getByRole('button', { name: 'الملاحظات والنقاش' }).click();
  await expect(page.getByText('النقاش مع المدرب غير متاح حاليًا.', { exact: false })).toBeVisible();
  await expect(page.getByText('سارة العتيبي')).toHaveCount(0);
  await page.getByLabel('ملاحظة خاصة لهذا الدرس').fill('ملاحظتي على الدرس الأول');
  await page.getByRole('button', { name: 'حفظ ملاحظة خاصة' }).click();
  await expect(page.getByText('ملاحظتي على الدرس الأول')).toBeVisible();
  await page.getByRole('button', { name: /الدرس الثاني/ }).click();
  await expect(page.getByText('نص الدرس الثاني الحصري')).toBeVisible();
  await expect(page.getByText('ملاحظتي على الدرس الأول')).toHaveCount(0);
  await page.getByLabel('ملاحظة خاصة لهذا الدرس').fill('ملاحظتي على الدرس الثاني');
  await page.getByRole('button', { name: 'حفظ ملاحظة خاصة' }).click();
  await page.reload();
  await page.getByRole('button', { name: 'الملاحظات والنقاش' }).click();
  await expect(page.getByText('ملاحظتي على الدرس الثاني')).toBeVisible();
  await expect(page.getByText('ملاحظتي على الدرس الأول')).toHaveCount(0);
});

test('interactive video answers are scoped to the signed-in student', async ({ page }) => {
  test.setTimeout(120_000);
  await setup(page);
  const video = { ...detail('lesson-a'), type: 'video', durationSeconds: 120, videoUrl: '/media/test.mp4', videoSource: 'upload', contentText: JSON.stringify({interactiveQuestions: [{id:'question-one',timestamp:1,mustPass:true,actionOnFail:'continue',rewatchTimestamp:0,inlineQuestion:{text:'سؤال',options:['أ','ب'],correctOptionIndex:0}}]}) };
  await page.route('**/api/v1/learning-spaces/courses/course-1/lessons/lesson-a', route => json(route, { lesson: video }));
  await page.route('**/media/test.mp4', route => route.fulfill({ status: 200, headers: { 'Content-Type': 'video/mp4' }, body: '' }));
  await page.addInitScript(() => {
    localStorage.setItem('almeaa_answered:course-1:lesson-a', JSON.stringify(['question-one']));
    localStorage.setItem(`almeaa_answered_v2:${JSON.stringify(['other-student','course-1','lesson-a'])}`, JSON.stringify(['question-one']));
  });
  await page.goto('/learning/courses/course-1');
  await expect(page.getByText('تم إجابة 0 من 1')).toBeVisible();
  await page.evaluate(() => localStorage.setItem(`almeaa_answered_v2:${JSON.stringify(['student-1','course-1','lesson-a'])}`, JSON.stringify(['question-one'])));
  await page.reload();
  await expect(page.getByText('تم إجابة 1 من 1')).toBeVisible();
});

test('course exam starts only through its authorized course placement', async ({ page }) => {
  test.setTimeout(120_000);
  await setup(page);
  await page.route('**/api/v1/learning-spaces/courses/course-1', route => json(route, { course: { ...course, presentation: { assessments: [
    { id: 'display-card-1', quizId: 'real-quiz', title: 'اختبار مرتبط' },
    { id: 'manual-only', title: 'اختبار دون ربط' },
  ] } } }));
  let starts = 0, directStarts = 0;
  await page.route('**/api/v1/assessment-placements/available?*', route => {
    const q = new URL(route.request().url()).searchParams;
    expect([q.get('slot'),q.get('courseId'),q.get('pathId'),q.get('subjectId')]).toEqual(['course','course-1','path-1','sub-1']);
    return json(route,{items:[{placementId:'placement-1',assessmentId:'real-quiz',title:'اختبار مرتبط',slot:'course',courseId:'course-1',pathId:'path-1',subjectId:'sub-1',accessAllowed:true,canStart:true}],page:1,hasMore:false});
  });
  await page.route('**/api/v1/assessment-placements/placement-1/start', route => { starts++; return json(route,{attempt:{id:'attempt-1',assessmentId:'real-quiz'}}); });
  await page.route('**/api/v1/assessments/real-quiz/attempts', route => {directStarts++; return json(route,{},500);});
  await page.goto('/learning/courses/course-1');
  await page.getByRole('button', {name: 'اختبارات الدورة'}).click();
  await expect(page.getByText('لم يُفعّل موضعه في الدورة')).toBeVisible();
  await page.getByRole('button', {name:'بدء الاختبار', exact:true}).click();
  await expect(page).toHaveURL(/\/assessment-attempts\/attempt-1\?/);
  expect(new URL(page.url()).searchParams.get('returnTo')).toBe('/learning/courses/course-1?lesson=lesson-a');
  await page.goto('/course/course-1?tab=tests');
  await page.getByRole('button', {name:'بدء الاختبار',exact:true}).click();
  await expect(page).toHaveURL(/\/assessment-attempts\/attempt-1\?/);
  expect(new URL(page.url()).searchParams.get('returnTo')).toBe('/course/course-1?tab=tests');
  expect(starts).toBe(2);
  expect(directStarts).toBe(0);
});

test('course assessment rejects another course scope and never starts it', async ({ page }) => {
  test.setTimeout(120_000);
  await setup(page);
  let starts = 0;
  await page.route('**/api/v1/assessment-placements/available?*', route => json(route,{items:[{placementId:'wrong',assessmentId:'quiz',title:'غير صحيح',slot:'course',courseId:'another-course',pathId:'path-1',subjectId:'sub-1',accessAllowed:true,canStart:true}],page:1,hasMore:false}));
  await page.route('**/api/v1/assessment-placements/*/start', route => {starts++; return json(route,{},500);});
  await page.goto('/learning/courses/course-1');
  await page.getByRole('button',{name:'اختبارات الدورة'}).click();
  await expect(page.getByRole('alert')).toContainText('تعذر التحقق من نطاق اختبارات الدورة');
  await expect(page.getByRole('button',{name:'بدء الاختبار'})).toHaveCount(0);
  expect(starts).toBe(0);
});

test('course files show only real safe links and lock paid files for guests', async ({ page }) => {
  test.setTimeout(120_000);
  await setup(page);
  await page.route('**/api/v1/learning-spaces/courses/course-1', route => json(route, { course: { ...course, access: {allowed:false,configured:true,reason:'purchase_required'}, presentation: { files: [
    {id:'free',title:'ملف مجاني',url:'https://example.test/free.pdf',access:'free_preview'},
    {id:'paid',title:'ملف مدفوع',url:'https://example.test/paid.pdf',access:'enrolled_paid'},
    {id:'bad',title:'ملف بلا رابط صالح',url:'javascript:alert(1)',access:'free_preview'},
  ] } } }));
  await page.goto('/course/course-1?tab=files');
  await expect(page.getByRole('link', {name:'تحميل ملف مجاني'})).toHaveAttribute('href','https://example.test/free.pdf');
  await expect(page.getByRole('link', {name:'تحميل ملف مدفوع'})).toHaveCount(0);
  await expect(page.getByText('ضمن شراء الدورة').first()).toBeVisible();
  await expect(page.getByText('الرابط غير متاح')).toBeVisible();
  await expect(page.getByText('الحقيبة التدريبية الشاملة', {exact:false})).toHaveCount(0);
});

test('course completion uses server progress and does not issue a fake certificate', async ({ page }) => {
  test.setTimeout(120_000);
  await setup(page);
  let completed = ['lesson-a'];
  await page.route('**/api/v1/learning-progress/courses/course-1/completed', route => json(route, {courseId:'course-1',completedLessonIds:completed}));
  await page.route('**/api/v1/learning-spaces/courses/course-1/lessons/lesson-b', route => json(route, {lesson:detail('lesson-b')}));
  await page.route('**/api/v1/learning-progress/lessons/lesson-b/complete', route => {completed = ['lesson-a','lesson-b']; return json(route, {progress:progress('lesson-b','completed')});});
  await page.addInitScript(() => localStorage.setItem('completed_lessons_store', JSON.stringify(['lesson-a','lesson-b'])));
  await page.goto('/course/course-1');
  await expect(page.getByText('50%', {exact:true})).toBeVisible();
  await page.goto('/learning/courses/course-1?lesson=lesson-b');
  await expect(page.getByText('نص الدرس الثاني الحصري')).toBeVisible();
  await page.getByRole('button',{name:'الشهادة والإنجاز'}).click();
  await expect(page.getByText('50%',{exact:true})).toBeVisible();
  await expect(page.getByText('إصدار الشهادات غير متاح حاليًا.',{exact:false})).toBeVisible();
  await page.getByRole('button',{name:'تحديد كمكتمل'}).click();
  await expect(page.getByText('100%',{exact:true})).toBeVisible();
  await expect(page.getByRole('button',{name:'تحميل وثيقة الشهادة (PDF)'})).toHaveCount(0);
  await page.reload();
  await page.getByRole('button',{name:'الشهادة والإنجاز'}).click();
  await expect(page.getByText('100%',{exact:true})).toBeVisible();
});

test('course progress is unavailable when server progress fails', async ({ page }) => {
  test.setTimeout(120_000);
  await setup(page);
  await page.route('**/api/v1/learning-progress/courses/course-1/completed', route => json(route,{message:'offline'},503));
  await page.goto('/course/course-1');
  await expect(page.getByText('غير متاح',{exact:true})).toBeVisible();
  await page.goto('/learning/courses/course-1');
  await page.getByRole('button',{name:'الشهادة والإنجاز'}).click();
  await expect(page.getByText('تعذر تحميل التقدم')).toBeVisible();
});

test('a completion response for another lesson cannot update progress or report success', async ({ page }) => {
  test.setTimeout(120_000);
  await setup(page);
  await page.route('**/api/v1/learning-progress/lessons/lesson-a/complete', route => json(route,{progress:progress('lesson-b','completed')}));
  await page.goto('/learning/courses/course-1');
  await expect(page.getByText('نص الدرس الأول الحصري')).toBeVisible();
  await page.getByRole('button',{name:'تحديد كمكتمل'}).click();
  await expect(page.getByText('تعذر تأكيد اكتمال هذا الدرس؛ لم تُستخدم بيانات درس آخر.')).toBeVisible();
  await expect(page.getByText('تم تسجيل الدرس كمكتمل.')).toHaveCount(0);
  await expect(page.getByRole('button',{name:'تحديد كمكتمل'})).toBeEnabled();
});

test('course overview does not invent shared discussions or delete old local data', async ({ page }) => {
  test.setTimeout(120_000);
  await setup(page);
  await page.addInitScript(() => localStorage.setItem('course_qa_course-1', JSON.stringify([{id:'old',question:'سؤال قديم خاص بالجهاز',replies:[]}])));
  await page.goto('/course/course-1?tab=qa');
  await expect(page.getByText('النقاش مع المدرب غير متاح حاليًا.',{exact:false})).toBeVisible();
  await expect(page.getByText('سارة العتيبي')).toHaveCount(0);
  await expect(page.getByText('سؤال قديم خاص بالجهاز')).toHaveCount(0);
  expect(await page.evaluate(() => localStorage.getItem('course_qa_course-1'))).toContain('سؤال قديم خاص بالجهاز');
});

test('late course progress cannot erase a newly confirmed completion', async ({ page }) => {
  test.setTimeout(120_000);
  await setup(page);
  let releaseProgress: (() => void) | undefined;
  await page.route('**/api/v1/learning-progress/courses/course-1/completed', async route => {
    await new Promise<void>(resolve => { releaseProgress = resolve; });
    return json(route,{courseId:'course-1',completedLessonIds:[]});
  });
  await page.route('**/api/v1/learning-progress/lessons/lesson-a/complete', route => json(route,{progress:progress('lesson-a','completed')}));
  await page.goto('/learning/courses/course-1');
  await expect.poll(() => Boolean(releaseProgress)).toBe(true);
  await expect(page.getByText('نص الدرس الأول الحصري')).toBeVisible();
  await page.getByRole('button',{name:'تحديد كمكتمل'}).click();
  await expect(page.getByText('تم تسجيل الدرس كمكتمل.')).toBeVisible();
  releaseProgress?.();
  await page.getByRole('button',{name:'الشهادة والإنجاز'}).click();
  await expect(page.getByText('50%',{exact:true})).toBeVisible();
});

test('guest sees free and locked course assessments and signs in to start', async ({ page }) => {
  test.setTimeout(120_000);
  await setup(page);
  await page.route('**/api/v1/auth/me', route => json(route,{message:'unauthenticated'},401));
  await page.route('**/api/v1/assessment-placements/available?*', route => json(route,{items:[
    {placementId:'free',assessmentId:'q1',title:'اختبار مجاني',slot:'course',courseId:'course-1',pathId:'path-1',subjectId:'sub-1',accessAllowed:true,canStart:true},
    {placementId:'paid',assessmentId:'q2',title:'اختبار مغلق',slot:'course',courseId:'course-1',pathId:'path-1',subjectId:'sub-1',accessAllowed:false,canStart:false},
  ],page:1,hasMore:false}));
  await page.goto('/course/course-1?tab=tests');
  await expect(page.getByText('اختبار مجاني')).toBeVisible();
  await expect(page.getByText('اختبار مغلق')).toBeVisible();
  await expect(page.getByRole('link',{name:'تسجيل الدخول للبدء'})).toBeVisible();
  await expect(page.getByRole('button',{name:'مغلق'})).toBeDisabled();
});

test('course placement retry reuses the same start key after a failed response', async ({ page }) => {
  test.setTimeout(120_000);
  await setup(page);
  const keys: string[] = [];
  await page.route('**/api/v1/assessment-placements/available?*', route => json(route,{items:[{placementId:'p1',assessmentId:'q1',title:'اختبار الدورة',slot:'course',courseId:'course-1',pathId:'path-1',subjectId:'sub-1',accessAllowed:true,canStart:true}],page:1,hasMore:false}));
  await page.route('**/api/v1/assessment-placements/p1/start', route => {
    keys.push(route.request().postDataJSON().startKey);
    return keys.length === 1 ? json(route,{message:'تعذر البدء'},503) : json(route,{attempt:{id:'attempt-1',assessmentId:'q1'}});
  });
  await page.goto('/learning/courses/course-1');
  await page.getByRole('button',{name:'اختبارات الدورة'}).click();
  await page.getByRole('button',{name:'بدء الاختبار'}).click();
  await expect(page.getByRole('alert')).toContainText('تعذر البدء');
  await page.getByRole('button',{name:'بدء الاختبار'}).click();
  await expect(page).toHaveURL(/\/assessment-attempts\/attempt-1\?/);
  expect(keys).toHaveLength(2);
  expect(keys[0]).toBe(keys[1]);
});
