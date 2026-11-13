import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import '../../../src/app/styles.css';
import { SkillSectionManager } from '../../../src/features/taxonomy/components/SkillSectionManager';
import { taxonomyAdminClient, type AdminTaxonomyBootstrap } from '../../../src/features/taxonomy/api/taxonomy-admin-client';

function Fixture() {
  const [data, setData] = useState<AdminTaxonomyBootstrap>({ paths: [], levels: [], subjects: [], skills: [], sections: [] });
  useEffect(() => { void taxonomyAdminClient.bootstrap().then(setData); }, []);
  const run = async (_key: string, action: (csrf: string) => Promise<void>) => {
    try { await action('csrf'); setData(await taxonomyAdminClient.bootstrap()); return true; } catch { return false; }
  };
  return <SkillSectionManager subjectId="subject1" sections={data.sections || []} skills={data.skills} pending="" run={run} />;
}
createRoot(document.getElementById('root')!).render(<Fixture />);
