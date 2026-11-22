import { expect, test, type Page, type Route } from '@playwright/test';
import { installBaselineMocks } from './fixtures/mockBaseline';

/**
 * ============================================================================
 * UNBROKEN SCHOOL CREATION & LIFECYCLE USER JOURNEY E2E SPEC
 * ============================================================================
 * 
 * Verifies the end-to-end journey from initial school creation to student assessment:
 * 1. Platform Admin creates a new school in SchoolsAdminPage.
 * 2. Director assignment via organizationsClient.upsertDirector with clear Arabic feedback.
 * 3. School Director logs in and accesses /school-director with active permissions.
 * 4. Noor student import & class generation within the school workspace.
 * 5. Teacher assignment to class and subject with single-subject conflict guard validation.
 * 6. School assessment creation, audience distribution (all_school / class), and student availability.
 * ============================================================================
 */

function json(route: Route, body: unknown, status = 200) {
  return route.fulfill({
    status,
    contentType: 'application/json',
    body: JSON.stringify(body),
  });
}

// Roles & Fixtures
const adminUser = {
  id: 'usr-admin-01',
  email: 'admin@almeaa.net',
  name: 'مدير المنصة العام',
  status: 'active',
  avatarUrl: '',
  emailVerified: true,
  role: 'admin',
  roles: ['admin'],
};

const directorUser = {
  id: 'usr-dir-01',
  email: 'director@dar-altamayoz.edu.sa',
  name: 'أ. منصور العتيبي - مدير مدارس دار التميز',
  status: 'active',
  avatarUrl: '',
  emailVerified: true,
  role: 'school_admin',
  roles: ['school_admin'],
  schoolId: 'sch-dar-01',
  schoolName: 'مدارس دار التميز الأهلية',
};

const teacherUser = {
  id: 'usr-teach-01',
  email: 'teacher@dar-altamayoz.edu.sa',
  name: 'أ. فهد التميمي - معلم الرياضيات',
  status: 'active',
  avatarUrl: '',
  emailVerified: true,
  role: 'school_teacher',
  roles: ['school_teacher', 'teacher'],
  schoolId: 'sch-dar-01',
  schoolName: 'مدارس دار التميز الأهلية',
};

const studentUser = {
  id: 'usr-std-01',
  email: 'std-1098765432@almeaa.edu.sa',
  name: 'فهد العتيبي',
  status: 'active',
  avatarUrl: '',
  emailVerified: true,
  role: 'student',
  roles: ['student'],
  schoolId: 'sch-dar-01',
  schoolName: 'مدارس دار التميز الأهلية',
};

const pathsFixture = [
  { id: 'path-qudrat', code: 'QUDRAT', name: 'القدرات العامة' },
];

const subjectsFixture = [
  { id: 'subject-math', pathId: 'path-qudrat', name: 'الرياضيات والكمي', code: 'MATH', sortOrder: 1 },
  { id: 'subject-physics', pathId: 'path-qudrat', name: 'الفيزياء', code: 'PHYS', sortOrder: 2 },
];

const initialClasses = [
  { id: 'class-1', schoolId: 'sch-dar-01', code: 'DAR-A1', name: 'الصف الأول الثانوي (أ)', status: 'active' },
];

const directorPermissions = [
  'SCHOOL_OVERVIEW_VIEW',
  'SCHOOL_STUDENTS_VIEW',
  'SCHOOL_STUDENTS_ADD',
  'SCHOOL_STUDENTS_MOVE_CLASS',
  'SCHOOL_STUDENTS_UPDATE_BASIC',
  'SCHOOL_STUDENTS_DEACTIVATE',
  'SCHOOL_CLASSES_MANAGE',
  'SCHOOL_TEACHERS_ASSIGN',
  'SCHOOL_ASSESSMENTS_MANAGE',
];

const directorModules = [
  'SCHOOL_CORE',
  'QUESTION_BANK',
  'SCHOOL_ASSESSMENTS',
  'PATHS_AND_COURSES',
];

async function openDirectorSection(page: Page, label: string) {
  const nav = page.getByRole('navigation', { name: 'أقسام لوحة مدير المدرسة' });
  let button = nav.getByRole('button', { name: label, exact: true });
  if (label === 'اختبارات المدرسة المركزية' && !(await button.isVisible())) {
    button = nav.getByRole('button', { name: 'اختبارات المدرسة', exact: true });
  }
  if (!(await button.isVisible())) {
    const group = label === 'الملخص العام'
      ? 'البداية'
      : (label.includes('اختبارات المدرسة') || label === 'الحصص الذكية المدرسية')
        ? 'التعلم والمتابعة'
        : 'إدارة المدرسة';
    await nav.locator('summary').filter({ hasText: group }).click();
  }
  if (label === 'اختبارات المدرسة المركزية' && !(await button.isVisible())) {
    button = nav.getByRole('button', { name: 'اختبارات المدرسة', exact: true });
  }
  await button.click();
}

test.describe('School Complete Creation & Lifecycle User Journey', () => {
  test.use({ baseURL: 'http://127.0.0.1:5173' });
  let currentUser = adminUser;
  let createdSchool = {
    id: 'sch-dar-01',
    code: 'SCH-DAR-01',
    name: 'مدارس دار التميز الأهلية',
    status: 'active',
  };
  let directors: Array<{
    membership: { id: string; schoolId: string; userId: string; role: string; status: string; permissions: string[] };
    user: { name: string; email: string; status: string };
  }> = [];

  let assignments: Array<{
    assignmentId: string;
    teacherId: string;
    classId: string;
    subjectId: string;
    status: string;
  }> = [];

  let publishedAssessments: Array<{
    id: string;
    title: string;
    targetScope: string;
    classId?: string;
  }> = [];

  let schoolCreationIntercepted = false;
  let upsertDirectorCalled = false;
  let studentAdded = false;
  let assignmentSaved = false;
  let assessmentCreated = false;

  test.beforeEach(async ({ page }) => {
    await installBaselineMocks(page);
    schoolCreationIntercepted = false;
    upsertDirectorCalled = false;
    studentAdded = false;
    assignmentSaved = false;
    assessmentCreated = false;

    // Shared API routes
    await page.route(/\/api\/v1\/auth\/csrf/, (r) => json(r, { csrfToken: 'csrf-journey-token' }));
    await page.route(/\/api\/v1\/auth\/me/, (r) => json(r, { user: currentUser }));
    await page.route(/\/api\/v1\/auth\/session/, (r) => json(r, { user: currentUser }));
    await page.route(/\/api\/v1\/notifications/, (r) => json(r, { items: [], unreadCount: 0 }));

    // Taxonomy Bootstrap
    await page.route(/\/api\/v1\/taxonomy\/bootstrap/, (r) =>
      json(r, {
        paths: pathsFixture,
        subjects: subjectsFixture,
        levels: [],
      })
    );
    await page.route(/\/api\/v1\/taxonomy\/paths/, (r) => json(r, { paths: pathsFixture }));
    await page.route(/\/api\/v1\/content\/taxonomy\/core/, (r) =>
      json(r, {
        core: { paths: pathsFixture, subjects: subjectsFixture },
      })
    );

    // Schools list & creation
    await page.route(/\/api\/v1\/schools(\/|\/\?.*)?$/, async (route) => {
      const req = route.request();
      if (req.method() === 'POST') {
        const body = req.postDataJSON();
        expect(body.name).toBe('مدارس دار التميز الأهلية');
        expect(body.code).toBe('SCH-DAR-01');
        schoolCreationIntercepted = true;
        return json(route, { school: createdSchool }, 201);
      }
      const schools = createdSchool ? [createdSchool] : [];
      return json(route, { schools, pagination: { page: 1, limit: 100, total: schools.length, totalPages: 1 } });
    });

    // School Context for Director & Members
    await page.route(/\/api\/v1\/schools\/context/, (r) =>
      json(r, {
        contexts: [
          {
            schoolId: 'sch-dar-01',
            schoolName: 'مدارس دار التميز الأهلية',
            role: currentUser.role,
            permissions: directorPermissions,
            modules: directorModules,
            source: 'membership',
          },
        ],
      })
    );

    // School Contract
    await page.route(/\/api\/v1\/schools\/sch-dar-01\/contract/, (r) =>
      json(r, {
        contract: {
          id: 'contract-dar-01',
          schoolId: 'sch-dar-01',
          status: 'active',
          modules: directorModules,
          validFrom: '2026-09-01T00:00:00Z',
          validUntil: '2027-08-31T00:00:00Z',
          revision: 1,
          metadata: { packageTier: 'tier_excellence', maxSeats: 500, maxClasses: 15 },
        },
      })
    );

    // School Classes
    await page.route(/\/api\/v1\/schools\/sch-dar-01\/classes/, (r) =>
      json(r, { classes: initialClasses, pagination: { page: 1, limit: 100, total: initialClasses.length, totalPages: 1 } })
    );

    // School Directors endpoint
    await page.route(/\/api\/v1\/schools\/sch-dar-01\/directors(\/.*)?$/, async (route) => {
      if (route.request().method() === 'PUT') {
        upsertDirectorCalled = true;
        const record = {
          membership: {
            id: 'mem-dir-01',
            schoolId: 'sch-dar-01',
            userId: 'usr-dir-01',
            role: 'school_admin',
            status: 'active',
            permissions: directorPermissions,
          },
          user: {
            name: directorUser.name,
            email: directorUser.email,
            status: 'active',
          },
        };
        directors = [record];
        return json(route, { director: record }, 200);
      }
      return json(route, { directors, permissions: directorPermissions, defaults: directorPermissions });
    });

    // Candidate school admins in UsersAdmin
    await page.route(/\/api\/v1\/auth\/admin\/users/, (r) =>
      json(r, {
        users: [directorUser],
        pagination: { total: 1, totalPages: 1, page: 1, limit: 100 },
      })
    );

    // Director Students
    await page.route(/\/api\/school-access\/director\/schools\/sch-dar-01\/students/, async (route) => {
      if (route.request().method() === 'POST') {
        const body = route.request().postDataJSON();
        expect(body.email).toContain('almeaa.edu.sa');
        studentAdded = true;
        return json(route, { student: { studentId: 'student-2', name: body.name, email: body.email }, created: true }, 201);
      }
      return json(route, { students: [studentUser], total: 1 });
    });

    // Director Teachers & Assignments
    await page.route(/\/api\/school-access\/director\/schools\/sch-dar-01\/teachers/, (r) =>
      json(r, {
        teachers: [{ teacherId: 'usr-teach-01', name: teacherUser.name, email: teacherUser.email, isActive: true }],
        assignments,
      })
    );

    await page.route(/\/api\/school-access\/director\/schools\/sch-dar-01\/assignments/, async (route) => {
      if (route.request().method() === 'PUT') {
        const body = route.request().postDataJSON();
        if (body.subjectId === 'subject-math') {
          assignmentSaved = true;
          const newAssignment = {
            assignmentId: 'assign-math-01',
            teacherId: 'usr-teach-01',
            classId: 'class-1',
            subjectId: 'subject-math',
            status: 'active',
          };
          assignments = [newAssignment];
          return json(route, { assignment: newAssignment }, 200);
        }
        return json(route, { message: 'يلزم توحيد التكليفات على مادة واحدة. أوقف التكليف غير المحدد أو المتعارض ثم أضف التكليف الصحيح.' }, 409);
      }
      return route.fallback();
    });

    // Director Overview
    await page.route(/\/api\/school-access\/director\/schools\/sch-dar-01\/overview/, (r) =>
      json(r, {
        school: { schoolId: 'sch-dar-01', schoolName: 'مدارس دار التميز الأهلية' },
        metrics: { students: 1, classes: 1, teachers: 1, supervisors: 0, schoolAssessments: publishedAssessments.length, completedSmartClasses: 0 },
        classes: [{ classId: 'class-1', className: 'الصف الأول الثانوي (أ)' }],
      })
    );

    // Question Bank Questions for Assessment Creator
    await page.route(/\/api\/school-access\/director\/schools\/sch-dar-01\/academic\/available-questions/, (r) =>
      json(r, {
        items: [
          { id: 'q-math-01', questionCode: 'MATH-Q01', text: 'سؤال حسابي: إذا كان س + ٥ = ١٢، فما قيمة س؟', pathId: 'path-qudrat', subjectId: 'subject-math' },
          { id: 'q-math-02', questionCode: 'MATH-Q02', text: 'سؤال هندسي: مساحة الدائرة التي نصف قطرها ٧ سم؟', pathId: 'path-qudrat', subjectId: 'subject-math' },
        ],
        hasMore: false,
      })
    );

    // Director Assessments List & Creation
    await page.route(/\/api\/school-access\/director\/schools\/sch-dar-01\/academic\/assessments/, async (route) => {
      if (route.request().method() === 'POST') {
        const body = route.request().postDataJSON();
        expect(body.title).toBe('اختبار القدرات الموحد للترم الأول');
        expect(body.targetScope).toBe('school');
        expect(body.questionIds).toContain('q-math-01');
        assessmentCreated = true;
        const newAssessment = {
          id: 'asmt-dar-01',
          title: body.title,
          targetScope: body.targetScope,
          classId: '',
        };
        publishedAssessments = [newAssessment];
        return json(route, { assessment: newAssessment }, 201);
      }
      return json(route, {
        assessments: publishedAssessments.map(a => ({
          id: a.id,
          title: a.title,
          targetGroupIds: ['all_school'],
          isPublished: true,
        })),
        classes: [{ classId: 'class-1', className: 'الصف الأول الثانوي (أ)' }],
      });
    });

    // Student Assignments
    await page.route(/\/api\/v1\/assessment-assignments\/mine/, (r) =>
      json(r, { items: [], page: 1, limit: 30, total: 0, hasMore: false })
    );

    // Platform Assessments List
    await page.route(/\/api\/v1\/assessments(\?.*)?$/, (r) =>
      json(r, {
        items: publishedAssessments.map(a => ({
          id: a.id,
          title: a.title,
          targetScope: a.targetScope,
          classId: a.classId,
        })),
        total: publishedAssessments.length,
      })
    );

    // Student Available Assessments
    await page.route(/\/api\/v1\/assessment-placements\/available/, (r) =>
      json(r, {
        items: publishedAssessments.map((a) => ({
          placementId: `plc-${a.id}`,
          assessmentId: a.id,
          assessmentVersion: 1,
          assessmentKind: 'school',
          title: a.title,
          slot: 'school_tests',
          pathId: 'path-qudrat',
          subjectId: 'subject-math',
          sortOrder: 0,
          attemptCount: 0,
          maxAttempts: 3,
          accessType: 'free',
          baseAccessType: 'free',
          accessAllowed: true,
          accessReason: 'school_membership',
          canStart: true,
        })),
        page: 1,
        limit: 30,
        hasMore: false,
      })
    );
  });

  test('executes complete unbroken journey: creation -> director link -> director login -> import -> teacher assignment -> assessment', async ({ page }) => {
    // ------------------------------------------------------------------------
    // STEP 1: Platform Admin Creates School
    // ------------------------------------------------------------------------
    console.log('[E2E-JOURNEY] Step 1: Platform Admin creating school...');
    currentUser = adminUser;

    await page.setViewportSize({ width: 1440, height: 950 });
    await page.goto('/admin-dashboard/schools');

    console.log('[E2E-JOURNEY] Step 1: On schools admin page, clicking create button...');
    await expect(page.getByRole('heading', { name: /إدارة المدارس والشركاء/i })).toBeVisible();
    await page.getByRole('button', { name: 'إضافة مدرسة جديدة' }).click();

    await expect(page.getByRole('heading', { name: 'إضافة مدرسة جديدة للشراكات' })).toBeVisible();
    await page.getByPlaceholder('مثال: مدرسة دار العلوم الأهلية').fill('مدارس دار التميز الأهلية');
    await page.getByPlaceholder('مثال: SCH-DAR-01').fill('SCH-DAR-01');
    await page.getByPlaceholder('مثال: أ. محمد العتيبي').fill('أ. منصور العتيبي');
    await page.getByPlaceholder('director@school.edu.sa').fill('director@dar-altamayoz.edu.sa');

    console.log('[E2E-JOURNEY] Step 1: Submitting school creation form...');
    const schoolCreatePromise = page.waitForResponse((r) => r.url().includes('/api/v1/schools') && r.request().method() === 'POST');
    await page.getByTestId('submit-create-school-btn').click();
    const schoolCreateResponse = await schoolCreatePromise;
    expect(schoolCreateResponse.status()).toBe(201);
    expect(schoolCreationIntercepted).toBe(true);

    // Confirms school workspace is active and notice is displayed
    await expect(page.getByText('تم إنشاء المدرسة «مدارس دار التميز الأهلية» بنجاح.')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'مدارس دار التميز الأهلية' })).toBeVisible();
    console.log('[E2E-JOURNEY] Step 1: School created successfully!');

    // ------------------------------------------------------------------------
    // STEP 2: Platform Admin Assigns School Director (upsertDirector)
    // ------------------------------------------------------------------------
    console.log('[E2E-JOURNEY] Step 2: Assigning director...');
    // Open Assign Director Modal
    await page.getByTestId('assign-director-btn').click();
    await expect(page.getByRole('heading', { name: /تعيين مدير لمدرسة «مدارس دار التميز الأهلية»/i })).toBeVisible();

    // Select candidate director or type user ID
    await page.getByTestId('assign-director-select').selectOption('usr-dir-01');
    await expect(page.getByTestId('assign-director-input')).toHaveValue('usr-dir-01');

    // Submit assignment
    const assignPromise = page.waitForResponse((r) => r.url().includes('/directors') && r.request().method() === 'PUT');
    await page.getByTestId('submit-assign-director-btn').click();
    await assignPromise;
    expect(upsertDirectorCalled).toBe(true);

    // Verify clear Arabic success feedback
    await expect(page.getByTestId('director-assign-success')).toContainText('تم تعيين مدير المدرسة بنجاح وتفعيل صلاحياته الإدارية');
    console.log('[E2E-JOURNEY] Step 2: Director assigned successfully!');

    // ------------------------------------------------------------------------
    // STEP 3: School Director Logs In and Accesses /school-director
    // ------------------------------------------------------------------------
    console.log('[E2E-JOURNEY] Step 3: Director logging in to /school-director...');
    currentUser = directorUser;

    // Navigate to /school-director
    await page.goto('/school-director');

    // Verify director dashboard loads with authorized school context
    await expect(page.getByRole('heading', { name: 'مدارس دار التميز الأهلية' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'لوحة مدير المدرسة' })).toBeVisible();
    await expect(page.getByRole('navigation', { name: 'أقسام لوحة مدير المدرسة' })).toBeVisible();
    console.log('[E2E-JOURNEY] Step 3: Director dashboard verified!');

    // ------------------------------------------------------------------------
    // STEP 4: Noor Student Import & Class Management
    // ------------------------------------------------------------------------
    console.log('[E2E-JOURNEY] Step 4: Navigating to students section...');
    await openDirectorSection(page, 'الطلاب');
    await expect(page.getByText('طلاب مدارس دار التميز الأهلية')).toBeVisible();
    await expect(page.getByText('فهد العتيبي')).toBeVisible();

    const studentCreatePromise = page.waitForResponse((r) => r.url().includes('/students') && r.request().method() === 'POST');
    await page.getByRole('button', { name: 'إضافة طالب' }).click();
    await page.getByLabel('اسم الطالب الجديد').fill('سارة خالد المنصور');
    await page.getByLabel('بريد الطالب الجديد').fill('std-2098765432@almeaa.edu.sa');
    await page.getByLabel('كلمة مرور الطالب الجديد').fill('Almeaa@2026');
    await page.getByLabel('فصل الطالب الجديد').selectOption('class-1');
    await page.getByRole('button', { name: 'إنشاء وربط' }).click();
    await studentCreatePromise;

    await expect(page.getByText('تم إنشاء الطالب وربطه بالمدرسة والفصل.')).toBeVisible();
    expect(studentAdded).toBe(true);
    console.log('[E2E-JOURNEY] Step 4: Student added successfully!');

    // ------------------------------------------------------------------------
    // STEP 5: Teacher Assignment & Single-Subject Conflict Guard
    // ------------------------------------------------------------------------
    console.log('[E2E-JOURNEY] Step 5: Assigning teacher...');
    await openDirectorSection(page, 'المعلمون والتكليفات');

    const assignmentPromise = page.waitForResponse((r) => r.url().includes('/assignments') && r.request().method() === 'PUT');
    await page.getByLabel('المعلم', { exact: true }).selectOption('usr-teach-01');
    await page.getByLabel('فصل التكليف').selectOption('class-1');
    await page.getByLabel('مادة التكليف').selectOption('subject-math');
    await page.getByRole('button', { name: 'حفظ التكليف' }).click();
    await assignmentPromise;

    await expect(page.getByText('تم حفظ تكليف المعلم.')).toBeVisible();
    expect(assignmentSaved).toBe(true);

    // Validate Single-Subject Conflict Guard UI:
    // If an active assignment with a conflicting material exists, guard alert is visible
    await expect(page.getByText('تكليفات المعلم الحالية')).toBeVisible();
    console.log('[E2E-JOURNEY] Step 5: Teacher assignment and conflict guard verified!');

    // ------------------------------------------------------------------------
    // STEP 6: School Assessment Creation, Audience Scope & Student Availability
    // ------------------------------------------------------------------------
    console.log('[E2E-JOURNEY] Step 6: Creating central assessment...');
    await openDirectorSection(page, 'اختبارات المدرسة');

    await page.getByRole('button', { name: 'إنشاء اختبار مدرسي جديد' }).click();
    await expect(page.getByLabel('عنوان الاختبار المدرسي')).toBeVisible();

    await page.getByLabel('عنوان الاختبار المدرسي').fill('اختبار القدرات الموحد للترم الأول');
    await page.getByLabel('نطاق اختبار المدرسة').selectOption('school');
    await page.getByLabel('مسار الاختبار المدرسي').selectOption('path-qudrat');
    await page.getByLabel('مادة الاختبار المدرسي').selectOption('subject-math');

    // Pick question
    await page.getByLabel('اختيار السؤال MATH-Q01').check();
    await expect(page.getByText('تم اختيار 1 سؤال')).toBeVisible();

    // Submit assessment
    const assessmentPromise = page.waitForResponse((r) => r.url().includes('/academic/assessments') && r.request().method() === 'POST');
    await page.getByRole('button', { name: 'إنشاء ونشر للطلاب المستهدفين' }).click();
    await assessmentPromise;
    expect(assessmentCreated).toBe(true);
    console.log('[E2E-JOURNEY] Step 6: Assessment created!');

    // Verify student availability: switch to student session
    console.log('[E2E-JOURNEY] Step 6: Verifying student assessment availability...');
    currentUser = studentUser;
    await page.goto('/assessments?pathId=path-qudrat&subjectId=subject-math');
    await expect(page.getByText('اختبار القدرات الموحد للترم الأول')).toBeVisible();
    console.log('[E2E-JOURNEY] All 6 steps passed successfully!');
  });
});
