const API_BASE = 'http://127.0.0.1:8080';

async function test() {
  console.log('Logging in...');
  const res = await fetch(`${API_BASE}/api/v1/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin@almeaa.com', password: 'Almeaa@2026' }),
  });
  const data = await res.json();
  const setCookies = res.headers.getSetCookie();
  
  let accessToken = '';
  for (const c of setCookies) {
    const parts = c.split(';')[0].split('=');
    if (parts[0].trim() === 'almeaa_access_token') {
      accessToken = parts.slice(1).join('=').trim();
    }
  }

  const headers = {
    'Content-Type': 'application/json',
    'Cookie': `almeaa_access_token=${accessToken}`,
    'Authorization': `Bearer ${accessToken}`,
    'X-CSRF-Token': data.csrfToken,
    'Accept': 'application/json',
  };

  // 1. Test Create Coupon with valid scope
  const couponCode = `AUDIT_${Date.now().toString().slice(-4)}`;
  console.log('Testing create coupon:', couponCode);
  const createCouponRes = await fetch(`${API_BASE}/api/v1/commerce/admin/discounts`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      code: couponCode,
      label: 'كوبون تدقيق المنصة الآلي',
      discountType: 'percentage',
      percentageBps: 2000,
      fixedMinor: null,
      status: 'active',
      minAmountMinor: 0,
      maxRedemptions: 50,
      startsAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 30 * 86400000).toISOString(),
      scopes: [{ scopeType: 'all', productId: '', productType: '' }],
    }),
  });
  console.log('Create coupon status:', createCouponRes.status);
  const couponData = await createCouponRes.json();
  console.log('Coupon response:', couponData);

  // 2. Test Create Main Skill
  const taxonomyRes = await fetch(`${API_BASE}/api/v1/taxonomy/admin/bootstrap`, { headers });
  const taxonomyData = await taxonomyRes.json();
  const subject = taxonomyData.subjects?.[0];

  if (subject) {
    const skillCode = `SKILL_MAIN_${Date.now().toString().slice(-4)}`;
    console.log('Testing create main skill under subject:', subject.name, 'with code:', skillCode);
    const createSkillRes = await fetch(`${API_BASE}/api/v1/taxonomy/admin/skills`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        subjectId: subject.id,
        parentSkillId: '',
        code: skillCode,
        name: 'مهارة تدقيق رئيسية مؤقتة',
        description: 'مهارة رئيسية تم إنشاؤها عبر الفحص الآلي المباشر',
        kind: 'main',
        sortOrder: 999,
      }),
    });
    console.log('Create skill status:', createSkillRes.status);
    const skillData = await createSkillRes.json();
    console.log('Skill data:', skillData);

    const newSkillId = skillData.skill?.id || skillData.id;
    if (newSkillId) {
      console.log('Updating created skill:', newSkillId);
      const updateSkillRes = await fetch(`${API_BASE}/api/v1/taxonomy/admin/skills/${newSkillId}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({
          name: 'مهارة تدقيق رئيسية مؤقتة (تم التحديث والتحقق بنجاح)',
          sortOrder: 1000,
        }),
      });
      console.log('Update skill status:', updateSkillRes.status);
      const updateData = await updateSkillRes.json();
      console.log('Update skill response:', updateData);
    }
  }
}

test().catch(console.error);
