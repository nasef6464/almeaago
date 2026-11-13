import type { TaxonomySkill, TaxonomySkillSection } from '../../content/api/content-types';

interface Props {
  skills: TaxonomySkill[];
  sections: TaxonomySkillSection[];
  selected: string[];
  onChange: (skills: string[]) => void;
}

export function SelfQuizSkillPicker({ skills, sections, selected, onChange }: Props) {
  const sectionIDs = new Set(sections.map(section => section.id));
  const groups = sections.map(section => ({ id: section.id, name: section.name, skills: skills.filter(skill => skill.sectionId === section.id) })).filter(group => group.skills.length);
  const ungrouped = skills.filter(skill => !skill.sectionId || !sectionIDs.has(skill.sectionId));
  if (ungrouped.length) groups.push({ id: '', name: 'مهارات أخرى', skills: ungrouped });
  function toggleGroup(group: TaxonomySkill[]) {
    const ids = new Set(group.map(skill => skill.id));
    const allSelected = group.every(skill => selected.includes(skill.id));
    onChange(allSelected ? selected.filter(id => !ids.has(id)) : [...new Set([...selected, ...ids])]);
  }
  return <div className="rounded-2xl border border-gray-100 p-4">
    <h2 className="text-sm font-black text-gray-900">نطاق المهارات</h2>
    <p className="mt-1 text-xs font-bold text-gray-500">اختر أكثر من مهارة أو اتركها للجميع.</p>
    <button type="button" onClick={() => onChange([])} className={`mt-3 w-full rounded-xl px-4 py-2 text-xs font-black ${selected.length === 0 ? 'bg-indigo-600 text-white' : 'border border-gray-200 text-gray-700'}`}>كل المهارات</button>
    <div className="mt-3 max-h-64 space-y-4 overflow-y-auto">{groups.map(group => <div key={group.id}>
      <button type="button" aria-pressed={group.skills.every(skill => selected.includes(skill.id))} onClick={() => toggleGroup(group.skills)} className="text-right text-xs font-black text-indigo-700">{group.name} ({group.skills.length})</button>
      <div className="mt-2 flex flex-wrap gap-2">{group.skills.map(skill => <label key={skill.id} className="rounded-full border border-gray-200 px-3 py-2 text-xs font-bold"><input type="checkbox" checked={selected.includes(skill.id)} onChange={event => onChange(event.target.checked ? [...selected, skill.id] : selected.filter(id => id !== skill.id))} /> {skill.name}</label>)}</div>
    </div>)}</div>
  </div>;
}
