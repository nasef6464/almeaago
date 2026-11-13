import { useState } from 'react';
import { taxonomyAdminClient, type AdminSkillSection, type AdminTaxonomySkill } from '../api/taxonomy-admin-client';

interface Props {
  subjectId: string;
  sections: AdminSkillSection[];
  skills: AdminTaxonomySkill[];
  pending: string;
  run: (key: string, action: (csrf: string) => Promise<void>, success: string) => Promise<boolean>;
}
export function SkillSectionManager({ subjectId, sections, skills, pending, run }: Props) {
  const [name, setName] = useState('');
  const [editing, setEditing] = useState('');
  const [editName, setEditName] = useState('');
  const [editOrder, setEditOrder] = useState(0);
  const rows = sections.filter(section => section.subjectId === subjectId);
  const mainSkills = skills.filter(skill => skill.subjectId === subjectId && skill.kind === 'main');
  async function create() {
    if (!name.trim()) return;
    const ok = await run('section-create', async csrf => { await taxonomyAdminClient.createSkillSection({ subjectId, name: name.trim(), sortOrder: (rows.length + 1) * 10 }, csrf); }, 'أُضيف قسم المهارات.');
    if (ok) setName('');
  }
  async function save(section: AdminSkillSection) {
    if (!editName.trim()) return;
    const ok = await run(`section-${section.id}`, async csrf => { await taxonomyAdminClient.updateSkillSection(section.id, { name: editName.trim(), sortOrder: editOrder }, csrf); }, 'حُفظ القسم.');
    if (ok) setEditing('');
  }
  return <section className="space-y-4 rounded-2xl border bg-white p-5 shadow-xs" aria-label="إدارة أقسام المهارات">
    <div><h3 className="font-black text-slate-900">أقسام المهارات</h3><p className="mt-1 text-xs text-slate-500">نظم مهارات المادة في أقسام، ثم اربط كل مهارة رئيسية بقسمها.</p></div>
    <div className="flex gap-2"><input aria-label="اسم قسم المهارات الجديد" value={name} onChange={event => setName(event.target.value)} maxLength={160} className="min-w-0 flex-1 rounded-lg border p-2 text-sm" placeholder="اسم القسم" /><button type="button" disabled={Boolean(pending) || !name.trim()} onClick={() => void create()} className="rounded-lg bg-indigo-600 px-4 text-sm font-bold text-white disabled:opacity-50">إضافة قسم</button></div>
    <div className="space-y-2">{rows.length === 0 ? <p className="text-xs text-slate-500">لا توجد أقسام لهذه المادة.</p> : rows.map(section => <div key={section.id} className="flex flex-wrap items-center gap-2 rounded-xl border p-3 text-sm">
      {editing === section.id ? <><input aria-label={`اسم ${section.name}`} value={editName} onChange={event => setEditName(event.target.value)} maxLength={160} className="min-w-0 flex-1 rounded border p-2" /><label className="text-xs">الترتيب <input aria-label={`ترتيب ${section.name}`} type="number" min={0} value={editOrder} onChange={event => setEditOrder(Math.max(0, Number(event.target.value) || 0))} className="w-20 rounded border p-2" /></label><button type="button" disabled={Boolean(pending) || !editName.trim()} onClick={() => void save(section)} className="font-bold text-indigo-700">حفظ</button><button type="button" onClick={() => setEditing('')}>إلغاء</button></> : <><span className="flex-1 font-bold">{section.name} {section.status === 'archived' && <span className="text-xs text-slate-500">(مؤرشف)</span>}</span><button type="button" disabled={Boolean(pending)} onClick={() => { setEditing(section.id); setEditName(section.name); setEditOrder(section.sortOrder); }} className="text-indigo-700">تعديل</button><button type="button" disabled={Boolean(pending)} onClick={() => void run(`section-${section.id}`, async csrf => { await taxonomyAdminClient.updateSkillSection(section.id, { status: section.status === 'active' ? 'archived' : 'active' }, csrf); }, section.status === 'active' ? 'أُرشف القسم.' : 'استُعيد القسم.')} className="text-amber-700">{section.status === 'active' ? 'أرشفة' : 'استعادة'}</button></>}
    </div>)}</div>
    {mainSkills.length > 0 && <div className="space-y-2 border-t pt-3"><h4 className="text-sm font-bold">ربط المهارات الرئيسية</h4>{mainSkills.map(skill => <label key={skill.id} className="grid gap-2 text-xs sm:grid-cols-2 sm:items-center"><span className="font-bold">{skill.name}</span><select aria-label={`قسم ${skill.name}`} value={skill.sectionId || ''} disabled={Boolean(pending)} onChange={event => { const sectionId = event.target.value; void run(`skill-section-${skill.id}`, async csrf => { await taxonomyAdminClient.setSkillSection(skill.id, sectionId, csrf); }, 'حُفظ ربط المهارة.'); }} className="rounded-lg border p-2"><option value="">بدون قسم</option>{rows.map(section => <option key={section.id} value={section.id} disabled={section.status !== 'active'}>{section.name}{section.status === 'archived' ? ' (مؤرشف)' : ''}</option>)}</select></label>)}</div>}
  </section>;
}
