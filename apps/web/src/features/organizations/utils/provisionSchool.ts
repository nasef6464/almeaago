import { OrganizationsApiError, organizationsClient, type SchoolClass, type SchoolContractData, type SchoolSummary } from '../api/organizations-client';

export interface SchoolSetup {
  requestId: string;
  schoolId?: string;
  name: string;
  code: string;
  city: string;
  stage: string;
  modules: string[];
  classNames: string[];
  directorId: string;
  validFrom: string;
  validUntil: string;
}

export const schoolSetupStages = {
  school: 'سجل المدرسة',
  contract: 'العقد وخدمات المدرسة',
  classes: 'الفصول المبدئية',
  director: 'ربط مدير المدرسة',
};
export type SchoolSetupStage = keyof typeof schoolSetupStages;

export class SchoolSetupError extends Error {
  constructor(readonly stage: SchoolSetupStage, message: string, readonly editable = false) {
    super(message);
  }
}

function matchesSchool(school: SchoolSummary, setup: SchoolSetup) {
  return school.id && school.code === setup.code && school.status === 'active'
    && school.metadata?.setupRequestId === setup.requestId;
}

async function ensureSchool(setup: SchoolSetup, csrf: string, onSchool: (id: string) => void) {
  let schoolId = setup.schoolId;
  if (!schoolId) {
    try {
      const { school } = await organizationsClient.createSchool({
        code: setup.code,
        name: setup.name,
        metadata: { setupRequestId: setup.requestId, location: setup.city, settings: { stage: setup.stage } },
      }, csrf);
      schoolId = school.id;
    } catch (error) {
      if (error instanceof OrganizationsApiError && error.status === 400) {
        throw new SchoolSetupError('school', 'راجع اسم المدرسة والرمز التعريفي ثم حاول مرة أخرى.', true);
      }
      if (!(error instanceof OrganizationsApiError) || error.status !== 409) throw error;
      let page = 1;
      while (!schoolId) {
        const response = await organizationsClient.findSchools(setup.code, page);
        schoolId = response.schools.find(school => matchesSchool(school, setup))?.id;
        if (page >= response.pagination.totalPages) break;
        page += 1;
      }
      if (!schoolId) {
        throw new SchoolSetupError('school', 'الرمز التعريفي مستخدم لمدرسة أخرى. اختر رمزًا مختلفًا.', true);
      }
    }
    if (!schoolId) throw new Error('Missing school identifier');
    onSchool(schoolId);
  }
  const { school } = await organizationsClient.school(schoolId);
  if (school.id !== schoolId || !matchesSchool(school, setup)) {
    throw new SchoolSetupError('school', 'تعذر التحقق من سجل المدرسة لهذا التأسيس.');
  }
  return school;
}

function contractMatches(contract: SchoolContractData, setup: SchoolSetup) {
  return contract.status === 'active' &&
    Date.parse(contract.validFrom ?? '') === Date.parse(setup.validFrom) &&
    Date.parse(contract.validUntil ?? '') === Date.parse(setup.validUntil) &&
    contract.modules.length === setup.modules.length &&
    setup.modules.every(module => contract.modules.includes(module));
}

async function ensureContract(schoolId: string, setup: SchoolSetup, csrf: string) {
  let saved: SchoolContractData | undefined;
  try {
    saved = (await organizationsClient.contract(schoolId)).contract;
  } catch (error) {
    if (!(error instanceof OrganizationsApiError) || error.status !== 404) throw error;
  }
  if (!saved) {
    await organizationsClient.updateContract(schoolId, {
      status: 'active', modules: setup.modules, validFrom: setup.validFrom, validUntil: setup.validUntil, expectedRevision: 0,
    }, csrf);
    saved = (await organizationsClient.contract(schoolId)).contract;
  }
  if (!contractMatches(saved, setup)) {
    throw new SchoolSetupError('contract', 'العقد المحفوظ يختلف عن اختيارات التأسيس. راجع العقد في مساحة المدرسة.');
  }
}

async function readClasses(schoolId: string) {
  const classes = new Map<string, SchoolClass>();
  for (let page = 1; ; page += 1) {
    const response = await organizationsClient.classes(schoolId, undefined, page);
    for (const item of response.classes) classes.set(item.code, item);
    if (page >= response.pagination.totalPages) return classes;
  }
}

async function ensureClasses(schoolId: string, setup: SchoolSetup, csrf: string) {
  if (!setup.classNames.length) return;
  const wanted = setup.classNames.map((name, index) => ({ name, code: `SETUP-${index + 1}` }));
  const existing = await readClasses(schoolId);
  for (const item of wanted) {
    const previous = existing.get(item.code);
    if (previous?.name === item.name) continue;
    if (previous) throw new SchoolSetupError('classes', 'تغيّر أحد الفصول المبدئية. راجع الفصول في مساحة المدرسة.');
    await organizationsClient.createClass(schoolId, item, csrf);
  }
  const saved = await readClasses(schoolId);
  if (wanted.some(item => saved.get(item.code)?.name !== item.name)) {
    throw new SchoolSetupError('classes', 'تعذر تأكيد حفظ الفصول المبدئية. أعد المحاولة.');
  }
}

async function ensureDirector(schoolId: string, directorId: string, csrf: string) {
  if (!directorId) return;
  const find = async () => (await organizationsClient.directors(schoolId)).directors
    .find(record => record.membership.userId === directorId);
  const existing = await find();
  if (existing?.membership.status === 'active') return;
  if (existing) throw new SchoolSetupError('director', 'تغيّر تفويض المدير أثناء التأسيس. راجع العلاقات في مساحة المدرسة.');
  await organizationsClient.upsertDirector(schoolId, directorId, { status: 'active' }, csrf);
  if ((await find())?.membership.status !== 'active') {
    throw new SchoolSetupError('director', 'تعذر تأكيد ربط حساب المدير. أعد المحاولة.');
  }
}

export async function provisionSchool(
  setup: SchoolSetup, csrf: string, onSchool: (id: string) => void, onStage: (stage: SchoolSetupStage) => void,
) {
  let stage: SchoolSetupStage = 'school';
  try {
    onStage(stage);
    const school = await ensureSchool(setup, csrf, onSchool);
    onStage(stage = 'contract');
    await ensureContract(school.id, setup, csrf);
    onStage(stage = 'classes');
    await ensureClasses(school.id, setup, csrf);
    if (setup.directorId) {
      onStage(stage = 'director');
      await ensureDirector(school.id, setup.directorId, csrf);
    }
    return school;
  } catch (error) {
    if (error instanceof SchoolSetupError) throw error;
    const status = error instanceof OrganizationsApiError ? error.status : 0;
    const explanation = status === 401 ? 'سجّل الدخول ثم أعد المحاولة.'
      : status === 403 ? 'تحقق من صلاحية حسابك ثم أعد المحاولة.'
      : 'أعد المحاولة لاستكمال الخطوات المحفوظة.';
    throw new SchoolSetupError(stage, `تعذر إكمال ${schoolSetupStages[stage]}. ${explanation}`);
  }
}
