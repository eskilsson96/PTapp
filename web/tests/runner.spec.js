import {test,expect} from '@playwright/test';
async function demo(page){await page.goto('/runner/');await page.getByRole('button',{name:'Try the sample runner'}).click();await expect(page.getByRole('heading',{name:/Your run/,level:1})).toBeVisible();}
async function nav(page,name){await page.getByRole('navigation',{name:'Runner navigation'}).getByRole('button',{name,exact:true}).click();}
test.beforeEach(async({page})=>{await page.route('https://tile.openstreetmap.org/**',r=>r.fulfill({status:200,contentType:'image/png',body:Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=','base64')}));});
test('Runner sample and all tabs fit a phone without changing original FitCraft data',async({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/');await page.getByRole('button',{name:/Try demo/}).click();const original=await page.evaluate(()=>localStorage.getItem('fitcraft.web.v1'));
 await demo(page);await page.screenshot({path:'test-results/Runner-Today.png',fullPage:true});
 for(const tab of ['Plan','Routes','Fuel','Log','Today']){await nav(page,tab);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);}
 expect(await page.evaluate(()=>localStorage.getItem('fitcraft.web.v1'))).toBe(original);expect(errors).toEqual([]);
});
test('Runner personal goal is reviewed before save, persists, and shows all pace estimates',async({page})=>{
 await page.goto('/runner/');await page.getByLabel('Your first name').fill('Sam');await page.getByRole('button',{name:'Marathon',exact:true}).click();await page.getByLabel('Requested weeks').fill('6');
 await page.getByRole('button',{name:'Review my running plan'}).click();await expect(page.getByRole('dialog').getByText(/Goal review: this template recommends/)).toBeVisible();
 await page.getByRole('button',{name:'Save recommended plan'}).click();await page.reload();await nav(page,'Plan');
 await page.getByText('Your E · M · T · I · R paces',{exact:true}).click();await expect(page.getByRole('heading',{name:'Repetition',exact:true})).toBeVisible();
 const state=await page.evaluate(()=>JSON.parse(localStorage.getItem('fitcraft.runner.v1')));expect(state.profile.name).toBe('Sam');expect(state.plan.recommendedWeeks).toBeGreaterThanOrEqual(16);
});
test('Runner practice works without GPS, pauses and saves an honest practice log',async({page})=>{
 await demo(page);await page.getByRole('button',{name:/Try a session/}).click();await page.getByRole('button',{name:'Start practice',exact:true}).click();
 await expect(page.locator('#run-phase')).toHaveText('Get ready');await page.getByRole('button',{name:'Pause',exact:true}).click();await expect(page.locator('#run-phase')).toContainText('PAUSED');
 const time=await page.locator('#run-time').textContent();await page.waitForTimeout(1100);await expect(page.locator('#run-time')).toHaveText(time);
 await page.getByRole('button',{name:'Resume',exact:true}).click();await page.getByRole('button',{name:'Skip phase'}).click();await expect(page.locator('#run-phase')).toHaveText('Practice work');
 await page.screenshot({path:'test-results/Runner-Practice.png',fullPage:true});await page.getByRole('button',{name:'Finish & save'}).click();
 await expect(page.getByText('PRACTICE · NO GPS',{exact:true})).toBeVisible();await page.reload();await nav(page,'Log');await expect(page.getByRole('heading',{name:'30-second practice'})).toBeVisible();
 const session=await page.evaluate(()=>JSON.parse(localStorage.getItem('fitcraft.runner.v1')).sessions[0]);expect(session.practice).toBe(true);expect(session.distance).toBe(0);expect(session.completedProgram).toBe(false);expect(session.skipped).toBe(1);
});
test('Runner low-readiness self-check converts a hard session to easy',async({page})=>{
 await demo(page);await page.getByRole('button',{name:'Need easy'}).click();await nav(page,'Plan');await page.getByRole('button',{name:/Norwegian 4 × 4/}).click();
 await expect(page.getByRole('dialog').getByText(/will switch this to an easy run/)).toBeVisible();await page.getByRole('button',{name:'Timer only · no GPS'}).click();await expect(page.getByRole('heading',{name:'Easy run',exact:true})).toBeVisible();
 await page.getByRole('button',{name:'Finish & save'}).click();const s=await page.evaluate(()=>JSON.parse(localStorage.getItem('fitcraft.runner.v1')).sessions[0]);expect(s.program).toBe('easy');expect(s.gps).toBe(false);
});
test('Runner GPS movement saves separately',async({page,context})=>{
 await context.grantPermissions(['geolocation']);await context.setGeolocation({latitude:59.3385,longitude:18.026,accuracy:5});await demo(page);
 await page.getByRole('button',{name:'Start easy run',exact:true}).click();await expect(page.locator('#run-phase')).toHaveText('Easy run');
 await context.setGeolocation({latitude:59.3385,longitude:18.026,accuracy:5});await expect(page.locator('#run-status')).toContainText('Recording');await page.waitForTimeout(1200);
 await context.setGeolocation({latitude:59.33856,longitude:18.026,accuracy:5});await expect.poll(async()=>Number(await page.locator('#run-distance').textContent())).toBeGreaterThan(0);
 await page.getByRole('button',{name:'Finish & save'}).click();await expect(page.getByText('GPS RUN',{exact:true})).toBeVisible();
 const s=await page.evaluate(()=>JSON.parse(localStorage.getItem('fitcraft.runner.v1')).sessions[0]);expect(s.gps).toBe(true);expect(s.distance).toBeGreaterThan(0);
});
test('Runner route generation and personal segment use service geometry',async({page,context})=>{
 await context.grantPermissions(['geolocation']);await context.setGeolocation({latitude:59.3385,longitude:18.026,accuracy:5});
 await page.route('https://routing.openstreetmap.de/**',r=>r.fulfill({json:{code:'Ok',routes:[{distance:5000,geometry:{coordinates:[[18.026,59.3385],[18.03,59.35],[18.04,59.34],[18.026,59.3385]]},legs:[]} ]}}));
 await demo(page);await nav(page,'Routes');await page.getByRole('button',{name:'Generate a running loop'}).click();await expect(page.getByRole('heading',{name:'5.0 km discovery loop'})).toBeVisible();
 await page.getByRole('button',{name:'Make this loop a segment'}).click();await page.getByLabel('Segment name').fill('My loop');await page.getByRole('button',{name:'Save personal segment'}).click();await expect(page.getByRole('heading',{name:'My loop'})).toBeVisible();
});
test('Runner and original FitCraft each reopen the correct offline page',async({page,context})=>{
 await demo(page);await page.evaluate(()=>navigator.serviceWorker.ready);await expect.poll(()=>page.evaluate(()=>Boolean(navigator.serviceWorker.controller))).toBe(true);
 await page.goto('/');await page.getByRole('button',{name:/Try demo/}).click();await page.goto('/runner/');
 await context.setOffline(true);await page.reload();await expect(page.getByRole('heading',{name:/Your run/,level:1})).toBeVisible();
 await page.goto('/');await expect(page.getByRole('heading',{name:'Today, Alex.'})).toBeVisible();
});
test('Runner kitchen recipe confirmation and logging update runner nutrition',async({page})=>{
 await demo(page);await nav(page,'Fuel');await page.getByRole('button',{name:'Snap fridge / find a recipe'}).click();
 for(const [name,grams]of [['Plain skyr',250],['Certified gluten-free oats',60],['Berries',100]]){await page.getByRole('checkbox',{name,exact:true}).check();await page.getByLabel(`Available grams · ${name}`,{exact:true}).fill(String(grams));}
 await page.getByRole('button',{name:'Confirm & find recipes'}).click();await page.getByRole('button',{name:'Log this meal'}).click();await page.getByRole('button',{name:'Close dialog'}).click();
 const s=await page.evaluate(()=>JSON.parse(localStorage.getItem('fitcraft.runner.v1')));expect(Object.values(s.logs)[0].meals['kitchen-oat-bowl'].protein).toBeGreaterThan(0);
});

test('Runner denied GPS keeps timer-only mode usable without inventing distance', async ({page}) => {
  await demo(page);
  await page.evaluate(() => { navigator.geolocation.getCurrentPosition = (_success, failure) => failure({code:1}); });
  await page.getByRole('button',{name:'Start easy run',exact:true}).click();
  await expect(page.locator('#toast')).toContainText('Location access is off');
  expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('fitcraft.runner.v1')).sessions.length)).toBe(0);
  await page.getByRole('button',{name:/Run without GPS/}).click();
  await expect(page.locator('#run-phase')).toHaveText('Easy run');
  await page.getByRole('button',{name:'Finish & save'}).click();
  const session=await page.evaluate(()=>JSON.parse(localStorage.getItem('fitcraft.runner.v1')).sessions[0]);
  expect(session.gps).toBe(false);expect(session.distance).toBe(0);
});
