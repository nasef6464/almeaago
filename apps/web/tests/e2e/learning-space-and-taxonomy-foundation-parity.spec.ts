import { expect, test, type Page, type Route } from '@playwright/test';

function json(route: Route, body: unknown, status = 200) {
  return route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
}

const mockAdminUser = {
  id: 'admin-1',
  email: 'admin@example.com',
  name: 'مدير المنصة',
  status: 'active',
  roles: ['admin'],
  role: 'admin',
};

const mockStudentUser = {
  id: 'student-1',
  email: 'student@example.com',
  name: 'طالب متميز',
  status: 'active',
  roles: ['student'],
  role: 'student',
};

const mockTaxonomy = {
  paths: [
    {
      id: 'p_qudrat',
      code: 'QUDRAT',
      name: 'القدرات العامة',
      parentPathId: '',
      description: 'مسار القدرات العامة (كمي ولفظي)',
      sortOrder: 1,
      status: 'active',
      color: 'indigo',
      icon: '📚',
      showInNavbar: true,
      showSubjectCards: true,
      showMockExamCard: true,
      showPackageCard: true,
    },
  ],
  levels: [],
  subjects: [
    {
      id: 'sub_quant',
      pathId: 'p_qudrat',
      levelId: '',
      code: 'QUANT',
      name: 'القدرات العامة - كمي',
      sortOrder: 1,
      status: 'active',
      color: 'indigo',
      icon: '📐',
    },
  ],
  skills: [],
};

const mockFoundation = {
  items: [
    {
      id: 'top_1',
      parentTopicId: '',
      pathId: 'p_qudrat',
      subjectId: 'sub_quant',
      code: 'TOPIC_ALGEBRA',
      title: 'الجبر والحساب',
      description: 'موضوع رئيسي يشمل المعادلات والأسس والجذور',
      sortOrder: 1,
      isVisible: true,
      isLocked: false,
    },
    {
      id: 'subtop_1_1',
      parentTopicId: 'top_1',
      pathId: 'p_qudrat',
      subjectId: 'sub_quant',
      code: 'SUBTOPIC_EQUATIONS',
      title: 'المعادلات الخطية والتربيعية',
      description: 'شرح المعادلات وحل المجاهيل',
      sortOrder: 1,
      isVisible: true,
      isLocked: false,
    },
  ],
  hasMore: false,
};

const mockPlacementsTraining = {
  items: [
    {
      placementId: 'plc_quant_drill_1',
      assessmentId: 'asm_drill_1',
      title: 'بنك تدريب الجبر السريع',
      description: 'تدريب تفاعلي غير مقيد بوقت',
      surface: 'learning_path',
      mode: 'training',
      durationMinutes: null,
      passingScore: 60,
      totalQuestions: 20,
      pathId: 'p_qudrat',
      subjectId: 'sub_quant',
      published: true,
      accessAllowed: true,
      canStart: true,
    },
  ],
  page: 1,
  limit: 50,
  hasMore: false,
};

const mockPlacementsTests = {
  items: [
    {
      placementId: 'plc_quant_test_1',
      assessmentId: 'asm_test_1',
      title: 'الاختبار الدوري الأول في الجبر',
      description: 'اختبار تجريبي دوري لمادة الكمي',
      surface: 'learning_path',
      mode: 'test',
      durationMinutes: 30,
      passingScore: 75,
      totalQuestions: 25,
      pathId: 'p_qudrat',
      subjectId: 'sub_quant',
      published: true,
      accessAllowed: true,
      canStart: true,
    },
  ],
  page: 1,
  limit: 50,
  hasMore: false,
};

async function setupLearnerMocks(page: Page) {
  await page.route('**/api/v1/auth/me', (route) => json(route, { user: mockStudentUser }));
  await page.route('**/api/v1/auth/csrf', (route) => json(route, { csrfToken: 'csrf-learner' }));
  await page.route('**/api/v1/taxonomy/bootstrap?phase=core', (route) => json(route, mockTaxonomy));
  await page.route('**/api/v1/taxonomy/bootstrap*', (route) => json(route, mockTaxonomy));
  await page.route('**/api/v1/learning/navigation-preferences', (route) =>
    json(route, { user: { id: 'student-1', enrolledPaths: ['p_qudrat'], pathStageSelections: [] } }),
  );
  await page.route('**/api/v1/learning-spaces/p_qudrat/subjects/sub_quant*', (route) =>
    json(route, {
      pathId: 'p_qudrat',
      subjectId: 'sub_quant',
      courses: { items: [], hasMore: false },
      foundation: mockFoundation,
      library: { items: [], hasMore: false },
    }),
  );
  await page.route('**/api/v1/assessment-placements/available*', (route) => {
    const url = route.request().url();
    if (url.includes('slot=training')) {
      return json(route, mockPlacementsTraining);
    }
    if (url.includes('slot=tests')) {
      return json(route, mockPlacementsTests);
    }
    return json(route, { items: [], hasMore: false });
  });
  await page.route('**/api/v1/assessment-placements/mock-exams*', (route) =>
    json(route, {
      items: [
        {
          placementId: 'plc_mock_1',
          title: 'الاختبار المحاكي الشامل للقدرات (الفترة الأولى)',
          description: 'اختبار يحاكي قياس بدقة متناهية لكامل المسار',
          durationMinutes: 120,
          totalQuestions: 100,
        },
      ],
      hasMore: false,
    }),
  );
}

async function setupAdminMocks(page: Page) {
  await page.route('**/api/v1/auth/me', (route) => json(route, { user: mockAdminUser }));
  await page.route('**/api/v1/auth/csrf', (route) => json(route, { csrfToken: 'csrf-admin' }));
  await page.route('**/api/v1/taxonomy/admin/bootstrap', (route) => json(route, mockTaxonomy));
  await page.route('**/api/v1/taxonomy/bootstrap?phase=core', (route) => json(route, mockTaxonomy));
  await page.route('**/api/v1/taxonomy/bootstrap*', (route) => json(route, mockTaxonomy));
  await page.route('**/api/v1/courses*', (route) => json(route, { items: [], page: 1, limit: 100, hasMore: false }));
  await page.route('**/api/v1/commerce/products*', (route) => json(route, { items: [], page: 1, limit: 100, hasMore: false }));
  await page.route('**/api/v1/foundation/topics*', (route) => {
    const url = route.request().url();
    if (url.includes('pathId=p_qudrat') && url.includes('subjectId=sub_quant')) {
      return json(route, mockFoundation);
    }
    return json(route, { items: [], hasMore: false });
  });
}

test('admin changes access from foundation, training and exam cards', async ({ page }, testInfo) => {
  test.setTimeout(150_000);
  await setupAdminMocks(page);
  const subject = { pathId: 'p_qudrat', subjectId: 'sub_quant' };
  const prefix = '/admin-dashboard/taxonomy?path=p_qudrat&subject=sub_quant&subjectTab=';
  let topic = { ...mockFoundation.items[0], status: 'active', revision: 7, skillIds: ['skill-1'] };
  await page.route('**/api/v1/foundation/topics*', route => json(route, { items: [topic], hasMore: false }));
  await page.route('**/api/v1/foundation/topics/top_1', async route => {
    if (route.request().method() === 'PUT') {
      expect(route.request().postDataJSON()).toMatchObject({
        isLocked: !topic.isLocked, isVisible: true, expectedRevision: topic.revision, skillIds: ['skill-1'],
      });
      topic = { ...topic, isLocked: !topic.isLocked, revision: topic.revision + 1 };
    }
    return json(route, { topic });
  });

  const exams = [
    { id: 'drill-1', title: 'تدريب التجربة', normalMode: 'practice', slot: 'training' },
    { id: 'exam-1', title: 'اختبار التجربة', normalMode: 'exam', slot: 'tests' },
  ].map(row => ({ ...row, ...subject, kind: 'normal', ownerType: 'platform', currentVersion: 2, isPublished: true }));
  await page.route('**/api/v1/assessments?*', route => {
    const filters = new URL(route.request().url()).searchParams;
    const mode = filters.get('normalMode');
    if (mode) {
      expect(filters.get('pathId')).toBe(subject.pathId);
      expect(filters.get('subjectId')).toBe(subject.subjectId);
    }
    return json(route, { items: exams.filter(exam => !mode || exam.normalMode === mode), hasMore: false });
  });
  for (const exam of exams) {
    let placement = { ...subject, id: 'place-' + exam.id, assessmentVersion: 2, slot: exam.slot, accessType: 'free', isVisible: false, sortOrder: 7, updatedAt: '2026-11-25T12:00:00Z' };
    await page.route('**/api/v1/assessments/' + exam.id, route => json(route, {
      assessment: { ...exam, publishedVersion: 2, version: { accessType: 'free' } },
    }));
    await page.route('**/api/v1/assessments/' + exam.id + '/placements?*', route => json(route, {
      items: [{ ...placement, id: 'other-topic', topicId: 'other-topic' }, placement],
      hasMore: false,
    }));
    await page.route('**/api/v1/assessment-placements/other-topic', () => {
      throw new Error('The card must not update a topic-specific placement');
    });
    await page.route('**/api/v1/assessment-placements/' + placement.id, route => {
      const accessType = placement.accessType === 'free' ? 'package' : 'free';
      expect(route.request().postDataJSON()).toEqual({
        expectedUpdatedAt: placement.updatedAt, accessType, isVisible: false, sortOrder: 7,
      });
      placement = { ...placement, accessType };
      return json(route, { placement });
    });
  }
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(prefix + 'foundation', { waitUntil: 'domcontentloaded' });
  await page.getByRole('button', { name: 'جعل الجبر والحساب ضمن باقة التأسيس' }).click();
  await expect(page.getByRole('button', { name: 'جعل الجبر والحساب مجانيًا' })).toBeVisible();
  await page.reload({ waitUntil: 'domcontentloaded' });
  const makeFoundationFree = page.getByRole('button', { name: 'جعل الجبر والحساب مجانيًا' });
  for (const width of [390, 820, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await expect(makeFoundationFree).toBeVisible();
    if (process.env.ALMEAA_CARD_SCREENSHOTS) {
      await makeFoundationFree.scrollIntoViewIfNeeded();
      await page.screenshot({ path: testInfo.outputPath(`foundation-${width}.png`) });
    }
  }
  await makeFoundationFree.click();
  await expect(page.getByRole('button', { name: 'جعل الجبر والحساب ضمن باقة التأسيس' })).toBeVisible();
  for (const [tab, exam] of [['questions', exams[0]], ['exams', exams[1]]] as const) {
    await page.goto(prefix + tab, { waitUntil: 'domcontentloaded' });
    await page.getByRole('button', { name: 'إتاحة ' + exam.title }).click();
    await page.getByRole('button', { name: 'جعله ضمن باقة', exact: true }).click();
    await expect(page.getByRole('button', { name: 'جعله مجانيًا', exact: true })).toBeVisible();
    await page.reload({ waitUntil: 'domcontentloaded' });
    const card = page.getByRole('article').filter({ hasText: exam.title });
    await card.getByRole('button', { name: 'إتاحة ' + exam.title }).click();
    await expect(card.getByText('ضمن باقة', { exact: true })).toBeVisible();
    for (const width of [390, 820, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      await expect(card.getByRole('button', { name: 'جعله مجانيًا', exact: true })).toBeVisible();
      if (process.env.ALMEAA_CARD_SCREENSHOTS) {
        await card.screenshot({ path: testInfo.outputPath(`${exam.slot}-${width}.png`) });
      }
    }
    await card.getByRole('button', { name: 'جعله مجانيًا', exact: true }).click();
    await expect(card.getByText('مجاني', { exact: true })).toBeVisible();
  }
});

test.describe('Learning Space & Foundation Workspace Parity', () => {
  test('Subject Learning Space: Training tab shows placement drills without mock exam confusion', async ({
    page,
  }) => {
    await setupLearnerMocks(page);
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/category/p_qudrat?subject=sub_quant&tab=questions');

    // 1. Verify header breadcrumb and subject identity
    await expect(page.getByRole('heading', { name: 'القدرات العامة (القدرات العامة - كمي)' })).toBeVisible();

    // 2. Verify Training tab is active
    const trainingTab = page.getByRole('button', { name: 'التدريب', exact: true });
    await expect(trainingTab).toBeVisible();
    await expect(trainingTab).toHaveClass(/bg-indigo-600/);

    // 3. Verify real training placement card appears
    await expect(page.getByRole('heading', { name: 'بنك تدريب الجبر السريع' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'ابدأ التدريب' })).toBeVisible();
  });

  test('Subject Learning Space: Exams tab shows subject tests with path-level mock exam banner', async ({
    page,
  }) => {
    await setupLearnerMocks(page);
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/category/p_qudrat?subject=sub_quant&tab=exams');

    // 1. Verify Exams tab is active
    const examsTab = page.getByRole('button', { name: 'الاختبارات', exact: true });
    await expect(examsTab).toBeVisible();
    await expect(examsTab).toHaveClass(/bg-indigo-600/);

    // 2. Verify educational banner decoupling subject tests from path-level mock exams
    await expect(
      page.getByText('هل تبحث عن الاختبارات المحاكية الشاملة؟'),
    ).toBeVisible();
    const mockExamLink = page.getByRole('link', { name: 'فتح محاكيات المسار' });
    await expect(mockExamLink).toBeVisible();
    await expect(mockExamLink).toHaveAttribute('href', '/category/p_qudrat?tab=mock-exams');

    // 3. Verify real subject test placement card
    await expect(page.getByRole('heading', { name: 'الاختبار الدوري الأول في الجبر' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'ابدأ الاختبار' })).toBeVisible();
  });

  test('Taxonomy Admin: Subject Workspace restores Foundation Management tab and tree', async ({
    page,
  }) => {
    await setupAdminMocks(page);
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/admin-dashboard/taxonomy?path=p_qudrat&subject=sub_quant&subjectTab=foundation');

    // 1. Verify Subject Workspace header
    await expect(page.getByText('مساحة عمل وإدارة محتوى المادة (QUANT)')).toBeVisible();

    // 2. Verify Foundation tab is present and active
    const foundationTab = page.getByRole('button', { name: 'إدارة التأسيس والمواضيع' });
    await expect(foundationTab).toBeVisible();
    await expect(foundationTab).toHaveClass(/border-indigo-600/);

    // 3. Verify main topic card and attributes
    await expect(page.getByText('الجبر والحساب')).toBeVisible();
    await expect(page.getByText('TOPIC_ALGEBRA')).toBeVisible();
    await expect(page.getByText('1 موضوعات فرعية • ترتيب 1')).toBeVisible();

    // 4. Verify subtopic is visible in the tree
    await expect(page.getByText('المعادلات الخطية والتربيعية')).toBeVisible();
    await expect(page.getByText('(SUBTOPIC_EQUATIONS)')).toBeVisible();

    // 5. Verify action buttons (إضافة موضوع رئيسي, + موضوع فرعي, تعديل)
    await expect(page.getByRole('button', { name: 'إضافة موضوع رئيسي' })).toBeVisible();
    await expect(page.getByRole('button', { name: '+ موضوع فرعي' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'تعديل' }).first()).toBeVisible();
  });
});
