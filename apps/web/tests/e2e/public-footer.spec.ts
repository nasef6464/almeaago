import { expect, test } from '@playwright/test';

for (const width of [390,820,1440]) {
 test(`original shared footer links and return navigation at ${width}px`,async({page})=>{
  await page.setViewportSize({width,height:1000});
  await page.route('**/api/v1/auth/me',route=>route.fulfill({status:401,contentType:'application/json',body:'{}'}));
  await page.route('**/api/v1/taxonomy/bootstrap?phase=core',route=>route.fulfill({contentType:'application/json',body:'{"paths":[],"subjects":[]}'}));
  await page.goto('/');
  const footer=page.getByRole('contentinfo');
  await expect(footer).toHaveCount(1);
  await expect(footer).toHaveCSS('background-color','rgb(249, 250, 251)');
  const links=[['من نحن','/about'],['تواصل معنا','/contact'],['الأسئلة الشائعة','/faq'],['سياسة الخصوصية','/privacy'],['الشروط والأحكام','/terms']];
  await expect(footer.getByRole('link')).toHaveCount(5);
  for(const [label,url] of links) {
   await footer.getByRole('link',{name:label,exact:true}).click();
   await expect(page).toHaveURL(new RegExp(`${url}$`));
   await expect(page.getByRole('contentinfo')).toHaveCount(1);
   await expect(page.getByRole('contentinfo').getByRole('link',{name:label,exact:true})).toHaveAttribute('href',url);
   await page.reload();
   await expect(page.getByRole('contentinfo')).toHaveCount(1);
   await page.goBack();
   await expect(page).toHaveURL(/\/$/);
  }
  await expect.poll(()=>page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await page.goto('/about/');
  await expect(page.getByRole('contentinfo')).toHaveCount(1);
  await footer.screenshot({path:`test-results/original-public-footer-${width}.png`});
 });
}
