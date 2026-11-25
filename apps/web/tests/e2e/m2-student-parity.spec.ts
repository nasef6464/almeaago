import { expect, test, type Page, type Route } from '@playwright/test';
import { installBaselineMocks } from './fixtures/mockBaseline';

const studentUser = {
  id: '0199aabb-ccdd-7eee-8fff-001122334401',
  name: 'ليان العتيبي',
  email: 'layan@example.invalid',
  roles: ['student'],
  permissions: ['content:read', 'assessment:take'],
  avatarUrl: '',
};

const teacherUser = {
  id: '0199aabb-ccdd-7eee-8fff-001122334402',
  name: 'أ. فيصل الدوسري',
  email: 'faisal@example.invalid',
  roles: ['teacher'],
  permissions: ['content:read', 'question:create'],
  avatarUrl: '',
};

function json(route: Route, data: unknown, status = 200) {
  return route.fulfill({
    status,
    contentType: 'application/json',
    body: JSON.stringify(data),
  });
}

const taxonomyData = {
  paths: [
    { id: '0199aabb-ccdd-7eee-8fff-001122334501', code: 'QUDRAT', name: 'القدرات العامة', sortOrder: 1 },
  ],
  levels: [],
  subjects: [
    {
      id: '0199aabb-ccdd-7eee-8fff-001122334601',
      pathId: '0199aabb-ccdd-7eee-8fff-001122334501',
      code: 'QUANT',
      name: 'الكمي',
      sortOrder: 1,
    },
  ],
  sections: [
    {
      id: '0199aabb-ccdd-7eee-8fff-001122334701',
      pathId: '0199aabb-ccdd-7eee-8fff-001122334501',
      subjectId: '0199aabb-ccdd-7eee-8fff-001122334601',
      name: 'الجبر والمعادلات',
      sortOrder: 1,
    },
  ],
  skills: [
    {
      id: '0199aabb-ccdd-7eee-8fff-001122334801',
      pathId: '0199aabb-ccdd-7eee-8fff-001122334501',
      subjectId: '0199aabb-ccdd-7eee-8fff-001122334601',
      sectionId: '0199aabb-ccdd-7eee-8fff-001122334701',
      name: 'المعادلات الخطية',
      sortOrder: 1,
    },
  ],
};

async function installStudentFlowMocks(page: Page) {
  await installBaselineMocks(page);

  const bookings: Array<Record<string, unknown>> = [];
  const qaItems: Array<Record<string, unknown>> = [
    {
      id: 'qa-item-1',
      subjectName: 'الكمي',
      authorId: studentUser.id,
      authorName: 'طالب',
      question: 'متى نستخدم استراتيجية تجريب الخيارات؟',
      latestReply: 'عندما تكون الخيارات أرقاماً صحيحة واضحة.',
      latestReplyBy: 'أ. فيصل الدوسري',
      repliesCount: 1,
      hasAnswer: true,
      isResolved: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  ];

  await page.route('**/api/v1/auth/me', (route) => json(route, { user: studentUser }));
  await page.route('**/api/v1/auth/csrf', (route) => json(route, { csrfToken: 'm2-csrf-token' }));
  await page.route('**/api/v1/taxonomy/bootstrap*', (route) => json(route, taxonomyData));

  await page.route('**/api/v1/reports/overview*', (route) =>
    json(route, {
      scope: {
        kind: 'student',
        studentCount: 1,
        sampledStudentCount: 1,
        isTruncated: false,
        limits: { students: 100, results: 100, attempts: 100 },
        canDetail: true,
        canExport: true,
      },
      assessment: {
        resultCount: 2,
        sampledResultCount: 2,
        resultsTruncated: false,
        attemptCount: 2,
        sampledAttemptCount: 2,
        attemptsTruncated: false,
        averageScore: 76,
        passed: 2,
        failed: 0,
        passRate: 100,
      },
      weakestSkills: [
        {
          skillId: '0199aabb-ccdd-7eee-8fff-001122334801',
          skillName: 'المعادلات الخطية',
          evidenceCount: 6,
          affectedStudents: 1,
          mastery: 45,
        },
      ],
    }),
  );

  await page.route('**/api/v1/reports/results*', (route) =>
    json(route, { items: [], page: 1, limit: 20, total: 0, hasMore: false }),
  );

  await page.route('**/api/v1/mastery/progress*', (route) =>
    json(route, {
      items: [
        {
          skillId: '0199aabb-ccdd-7eee-8fff-001122334801',
          skillTitle: 'المعادلات الخطية',
          pathId: '0199aabb-ccdd-7eee-8fff-001122334501',
          subjectId: '0199aabb-ccdd-7eee-8fff-001122334601',
          mastery: 45,
          attempts: 6,
          evidenceCount: 6,
          lastEvidenceAt: new Date().toISOString(),
          recommendedAction: 'remediation',
          status: 'weak',
        },
      ],
      page: 1,
      limit: 50,
      hasMore: false,
    }),
  );

  await page.route('**/api/v1/mastery/readiness*', (route) =>
    json(route, { readiness: { readySkillsCount: 0, totalSkillsCount: 1, percentage: 0, status: 'building' } }),
  );

  await page.route('**/api/v1/mastery/goals*', (route) =>
    json(route, { items: [], page: 1, limit: 20, hasMore: false }),
  );

  await page.route('**/api/v1/session-bookings/*', async (route) => {
    const req = route.request();
    const url = req.url();
    if (req.method() === 'POST' && url.endsWith('/api/v1/session-bookings/')) {
      const payload = req.postDataJSON() as Record<string, unknown>;
      const row = {
        id: `0199aabb-ccdd-7eee-8fff-00112233990${bookings.length + 1}`,
        userId: studentUser.id,
        requestKey: payload.requestKey,
        title: payload.title,
        targetLabel: payload.targetLabel,
        scheduledDate: payload.scheduledDate,
        scheduledTime: payload.scheduledTime,
        notes: payload.notes || '',
        skillIds: payload.skillIds || [],
        bookingStatus: 'pending',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      bookings.unshift(row);
      return json(route, { booking: row }, 201);
    }
    if (req.method() === 'PATCH' && url.endsWith('/cancel')) {
      const id = url.split('/').slice(-2, -1)[0];
      const idx = bookings.findIndex((b) => b.id === id);
      if (idx >= 0) {
        bookings[idx] = { ...bookings[idx], bookingStatus: 'cancelled' };
        return json(route, { booking: bookings[idx] });
      }
      return json(route, { message: 'not found' }, 404);
    }
    return json(route, { bookings });
  });

  await page.route('**/api/v1/learning-spaces/qa*', async (route) => {
    const req = route.request();
    if (req.method() === 'POST') {
      const payload = req.postDataJSON() as Record<string, unknown>;
      const created = {
        id: `qa-item-${qaItems.length + 1}`,
        subjectName: payload.subjectName || 'عام',
        authorId: studentUser.id,
        authorName: studentUser.name,
        question: payload.question,
        repliesCount: 0,
        hasAnswer: false,
        isResolved: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      qaItems.unshift(created);
      return json(route, { item: created }, 201);
    }
    return json(route, {
      items: qaItems,
      stats: {
        total: qaItems.length,
        answered: qaItems.filter((x) => x.hasAnswer).length,
        pending: qaItems.filter((x) => !x.hasAnswer).length,
      },
    });
  });

  await page.route('**/api/v1/learning-spaces/live-sessions', (route) =>
    json(route, {
      lessons: [
        {
          id: 'live-lesson-1',
          title: 'بث حل التجميعات الحديثة',
          description: 'مراجعة تفاعلية مباشرة',
          type: 'zoom',
          pathId: '0199aabb-ccdd-7eee-8fff-001122334501',
          pathName: 'القدرات العامة',
          subjectId: '0199aabb-ccdd-7eee-8fff-001122334601',
          subjectName: 'الكمي',
          teacherName: 'أ. فيصل الدوسري',
          meetingUrl: 'https://zoom.us/j/123456789',
          durationMinutes: 60,
          recordingUrl: '',
          showRecording: false,
          joinInstructions: 'ادخل قبل الموعد بخمس دقائق',
          isLocked: false,
        },
        {
          id: 'live-lesson-locked',
          title: 'لقاء المتفوقين المغلق',
          description: '',
          type: 'zoom',
          pathId: '0199aabb-ccdd-7eee-8fff-001122334501',
          pathName: 'القدرات العامة',
          subjectId: '0199aabb-ccdd-7eee-8fff-001122334601',
          subjectName: 'الكمي',
          teacherName: 'أ. فيصل الدوسري',
          meetingUrl: '',
          durationMinutes: 45,
          recordingUrl: '',
          showRecording: false,
          joinInstructions: '',
          isLocked: true,
        },
      ],
      classroomSessions: [],
    }),
  );

  await page.route('**/api/v1/learning-spaces/live-sessions/live-lesson-1', (route) =>
    json(route, {
      lesson: {
        id: 'live-lesson-1',
        title: 'بث حل التجميعات الحديثة',
        description: 'مراجعة تفاعلية مباشرة',
        type: 'zoom',
        pathId: '0199aabb-ccdd-7eee-8fff-001122334501',
        pathName: 'القدرات العامة',
        subjectId: '0199aabb-ccdd-7eee-8fff-001122334601',
        subjectName: 'الكمي',
        teacherName: 'أ. فيصل الدوسري',
        meetingUrl: 'https://zoom.us/j/123456789',
        durationMinutes: 60,
        recordingUrl: '',
        showRecording: false,
        joinInstructions: 'ادخل قبل الموعد بخمس دقائق',
        isLocked: false,
      },
    }),
  );

  await page.route('**/api/v1/learning-progress/courses/summary', (route) =>
    json(route, {
      courses: [
        {
          id: 'course-real-1',
          pathId: '0199aabb-ccdd-7eee-8fff-001122334501',
          pathName: 'القدرات العامة',
          subjectId: '0199aabb-ccdd-7eee-8fff-001122334601',
          subjectName: 'الكمي',
          category: 'القدرات العامة',
          title: 'دورة الكمي الواقعية',
          description: 'شرح منهجي متكامل',
          instructorName: 'أ. فيصل الدوسري',
          thumbnailAssetId: '',
          thumbnailUrl: '',
          certificateEnabled: true,
          isEnrolled: true,
          lessonsCount: 10,
          completedLessonsCount: 4,
          progress: 40,
          modules: [{ id: 'm1', title: 'أساسيات الجبر', lessons: [] }],
        },
      ],
    }),
  );

  await page.route('**/api/v1/learning-progress/achievements', (route) =>
    json(route, {
      summary: {
        completedLessons: 4,
        completedQuizzes: 2,
        perfectQuizzes: 1,
        masteredSkills: 3,
        enrolledCourses: 1,
        activityCount: 7,
        streakDays: 4,
        certificatesCount: 1,
        points: 240,
        level: 1,
        timeline: [],
      },
    }),
  );

  await page.route('**/api/v1/commerce/checkout/requests*', (route) =>
    json(route, { items: [], page: 1, limit: 50, hasMore: false }),
  );
}

test.describe('M2 Student, Reporting, Routes & Policy Parity', () => {
  test('Reports ?skillId= renders StudentSelectedSkillPanel, Skill Map, and links to /book-session flow', async ({ page }) => {
    await installStudentFlowMocks(page);

    let overviewUrl = '';
    await page.route('**/api/v1/reports/overview*', (route) => {
      overviewUrl = route.request().url();
      return json(route, {
        scope: {
          kind: 'student',
          studentCount: 1,
          sampledStudentCount: 1,
          isTruncated: false,
          limits: { students: 100, results: 100, attempts: 100 },
          canDetail: true,
          canExport: true,
        },
        assessment: {
          resultCount: 2,
          sampledResultCount: 2,
          resultsTruncated: false,
          attemptCount: 2,
          sampledAttemptCount: 2,
          attemptsTruncated: false,
          averageScore: 76,
          passed: 2,
          failed: 0,
          passRate: 100,
        },
        weakestSkills: [
          {
            skillId: '0199aabb-ccdd-7eee-8fff-001122334801',
            skillName: 'المعادلات الخطية',
            evidenceCount: 6,
            affectedStudents: 1,
            mastery: 45,
          },
        ],
      });
    });

    await page.goto('/reports?skillId=0199aabb-ccdd-7eee-8fff-001122334801');
    await expect.poll(() => overviewUrl).toContain('skillId=0199aabb-ccdd-7eee-8fff-001122334801');

    const skillPanel = page.getByTestId('student-selected-skill-panel');
    await expect(skillPanel).toBeVisible();
    await expect(skillPanel.getByText('المعادلات الخطية')).toBeVisible();

    await page.getByRole('button', { name: 'خريطة المهارات' }).click();
    await expect(page.getByRole('dialog', { name: 'خريطة المهارات' })).toBeVisible();
    await page.getByRole('button', { name: 'إغلاق خريطة المهارات' }).click();

    await skillPanel.getByRole('link', { name: 'حجز حصة خاصة' }).click();
    await expect(page).toHaveURL(/\/book-session\?/);
    await expect(page.locator('#booking-title')).toHaveValue(/المعادلات الخطية/);

    await page.getByRole('button', { name: 'تأكيد طلب حجز الحصة' }).click();
    await expect(page.getByText('تم استلام طلب الحجز بنجاح')).toBeVisible();

    await page.goto('/my-requests');
    await expect(page.getByText('حصة تقوية: المعادلات الخطية')).toBeVisible();
    await page.getByRole('button', { name: 'إلغاء الحجز' }).click();
    await expect(page.getByText('ملغي')).toBeVisible();
  });

  test('Q&A, Live Sessions Lobby, Courses real progress, and Legacy Route Compatibility', async ({ page }) => {
    await installStudentFlowMocks(page);

    // 1. /qa create + list
    await page.goto('/qa');
    await expect(page.getByText('متى نستخدم استراتيجية تجريب الخيارات؟')).toBeVisible();
    await page.getByRole('button', { name: 'اطرح سؤالاً جديداً' }).click();
    await page.locator('#qa-question').fill('ما قاعدة محيط الدائرة؟');
    await page.getByRole('button', { name: 'نشر السؤال' }).click();
    await expect(page.getByText('ما قاعدة محيط الدائرة؟')).toBeVisible();

    // 2. /live-sessions -> /live-sessions/:lessonId appends Zoom uname
    await page.goto('/live-sessions');
    await expect(page.getByText('بث حل التجميعات الحديثة')).toBeVisible();
    await expect(page.getByText('متاح للمشتركين')).toBeVisible();
    await page.getByRole('link', { name: 'فتح قاعة البث' }).click();
    await expect(page).toHaveURL(/\/live-sessions\/live-lesson-1/);
    const joinHref = await page.getByRole('link', { name: 'الانضمام للبث المباشر' }).getAttribute('href');
    expect(joinHref).toContain('uname=');

    // 3. /courses uses real progress, zero fake 4.9 rating
    await page.goto('/courses');
    await expect(page.getByText('دورة الكمي الواقعية')).toBeVisible();
    await expect(page.getByText('4 / 10 درس')).toBeVisible();
    await expect(page.getByText('4.9 تقييم')).toHaveCount(0);

    // 4. Legacy redirects (/results, /quiz/:quizId, /section/:catId, /b/:slug)
    await page.goto('/results?attempt=att-777');
    await expect(page).toHaveURL(/\/assessment-results\/att-777/);

    await page.goto('/quiz/q-999?source=course&courseId=c-1');
    await expect(page).toHaveURL(/\/assessments\/q-999\/start\?source=course&courseId=c-1/);

    await page.goto('/section/legacy-sec');
    await expect(page).toHaveURL(/\/dashboard$/);

    let barcodeCode = '';
    await page.route('**/api/v1/public-assessments/*/start', (route) => {
      const parts = route.request().url().split('/');
      barcodeCode = parts[parts.length - 2] || '';
      return json(route, { message: 'الرمز غير موجود' }, 404);
    });
    await page.goto('/b/QR-2026');
    await expect.poll(() => barcodeCode).toBe('QR-2026');
  });

  test('Quiz Generator route guard allows staff and blocks students', async ({ page }) => {
    await installStudentFlowMocks(page);
    await page.goto('/admin/quiz-gen');
    await expect(page).toHaveURL(/\/dashboard$/);

    await page.route('**/api/v1/auth/me', (route) => json(route, { user: teacherUser }));
    await page.goto('/admin/quiz-gen');
    await expect(page.getByRole('heading', { name: 'مولد الاختبارات والأسئلة الذكي' })).toBeVisible();
  });

  for (const vp of [
    { width: 390, height: 844 },
    { width: 820, height: 1180 },
    { width: 1440, height: 900 },
  ]) {
    test(`RTL zero horizontal overflow at ${vp.width}px across new M2 routes`, async ({ page }) => {
      test.setTimeout(60_000);
      await installStudentFlowMocks(page);
      const routes = ['/book-session', '/qa', '/live-sessions', '/my-requests', '/courses', '/achievements', '/reports'];
      await page.setViewportSize(vp);
      for (const routePath of routes) {
        await page.goto(routePath);
        await page.waitForLoadState('domcontentloaded');
        const overflow = await page.evaluate(() => ({
          scrollWidth: document.documentElement.scrollWidth,
          innerWidth: window.innerWidth,
        }));
        expect(
          overflow.scrollWidth,
          `${routePath} overflowed at ${vp.width}px (${overflow.scrollWidth} > ${overflow.innerWidth})`,
        ).toBeLessThanOrEqual(overflow.innerWidth + 1);
      }
    });
  }
});
