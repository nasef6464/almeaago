import type { HomepageSettings } from './homepage-types';

type SiteExperience = NonNullable<HomepageSettings['studentExperience']>;
export const defaultStudentSiteExperience: SiteExperience = { visibilityMode: 'all', promptEnrollment: true };
export const defaultPathStudentExperience = { stageSelection: 'auto' as const, stageLabel: 'اختر مرحلتك', studentTemplate: 'standard' as const };
const fieldClass = 'w-full rounded-xl border border-gray-200 px-3 py-2 mt-2 bg-white';

export function StudentSiteExperienceFields({ value, onChange, disabled = false }: {
    value?: HomepageSettings['studentExperience']; onChange: (value: SiteExperience) => void; disabled?: boolean;
}) {
    const settings = { ...defaultStudentSiteExperience, ...value };
    return <fieldset disabled={disabled} className="rounded-2xl border border-gray-100 bg-white p-6 space-y-4">
        <legend className="px-2 font-bold">تجربة الطالب في الموقع</legend>
        <label className="block font-bold">ما يظهر للطالب في الموقع
            <select className={fieldClass} value={settings.visibilityMode} onChange={e => onChange({ ...settings, visibilityMode: e.target.value as SiteExperience['visibilityMode'] })}>
                <option value="all">جميع المسارات المتاحة</option><option value="enrolled">مسارات الطالب المسجل فيها فقط</option>
            </select>
        </label>
        <p className="text-sm text-gray-500">يحدد عرض المسارات للطالب بعد الدخول. يمكن للطالب إدارة مساراته من حسابه.</p>
        <label className="flex items-center gap-3"><input type="checkbox" checked={settings.promptEnrollment} onChange={e => onChange({ ...settings, promptEnrollment: e.target.checked })} />تذكير الطالب باختيار مساره</label>
    </fieldset>;
}

