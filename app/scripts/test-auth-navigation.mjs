// Browser regression: login/logout and cached auth routes without a document reload.
// Run from app/: node scripts/test-auth-navigation.mjs (Chrome; optional CHROME_PATH/TEST_BASE_URL).
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { spawn } from 'node:child_process'
import { randomBytes } from 'node:crypto'
import assert from 'node:assert/strict'
import mysql from 'mysql2/promise'
import dotenv from 'dotenv'
dotenv.config({path:new URL('../.env.local',import.meta.url),quiet:true})
const base=process.env.TEST_BASE_URL||'http://localhost:3000';
const wait=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{
 const tempRoot=path.resolve(os.tmpdir());const profile=fs.mkdtempSync(path.join(tempRoot,'recipe-auth-nav-'));
 const proc=spawn(process.env.CHROME_PATH||'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',['--headless=new','--disable-gpu','--no-first-run','--remote-debugging-port=0','--user-data-dir='+profile,'about:blank'],{windowsHide:true,stdio:'ignore'});
 let ws,call,qaId,qaName;
 try{
  let port;for(let i=0;i<100;i++){try{port=fs.readFileSync(path.join(profile,'DevToolsActivePort'),'utf8').split('\n')[0];break}catch{await wait(100)}}if(!port)throw Error('No debug port');
  const tabs=await(await fetch('http://127.0.0.1:'+port+'/json')).json();const tab=tabs.find(t=>t.type==='page');
  ws=new WebSocket(tab.webSocketDebuggerUrl);await new Promise((r,j)=>{ws.onopen=r;ws.onerror=j});
  let id=0;const errors=[];const routeRequests=[];const requests=new Map();ws.onmessage=e=>{const m=JSON.parse(e.data);if(m.method==='Network.requestWillBeSent'){const u=new URL(m.params.request.url);if(['/','/home','/profile'].includes(u.pathname))routeRequests.push({path:u.pathname,method:m.params.request.method,type:m.params.type})}if(m.method==='Runtime.consoleAPICalled'&&m.params.type==='error')errors.push(m.params.args.map(a=>a.value||a.description).join(' '));if(m.method==='Runtime.exceptionThrown')errors.push(m.params.exceptionDetails.exception?.description||m.params.exceptionDetails.text);if(m.id&&requests.has(m.id)){const p=requests.get(m.id);requests.delete(m.id);clearTimeout(p.timer);if(m.error)p.reject(m.error);else p.resolve(m.result)}};
  call=(method,params={})=>new Promise((resolve,reject)=>{const key=++id;const timer=setTimeout(()=>{requests.delete(key);reject(Error('Timeout '+method))},30000);requests.set(key,{resolve,reject,timer});ws.send(JSON.stringify({id:key,method,params}))});
  const js=async(expression)=>{const r=await call('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(r.exceptionDetails)throw Error(r.exceptionDetails.exception?.description||r.exceptionDetails.text);return r.result.value};
  const until=async(expression)=>{for(let n=0;n<150;n++){try{if(await js('Boolean('+expression+')'))return}catch{}await wait(100)}console.log('TIMEOUT PAGE',await js(`({path:location.pathname,heads:Array.from(document.querySelectorAll('main h1')).map(n=>({text:n.textContent,visible:!!n.getClientRects().length})),auth:Array.from(document.querySelectorAll('header [data-authenticated]')).map(n=>n.dataset.authenticated),alerts:Array.from(document.querySelectorAll('[role=alert]')).map(n=>n.textContent)})`));console.log('ME',await js(`fetch('/api/auth/me').then(async r=>({status:r.status,name:(await r.json()).user?.displayName}))`));console.log('ERRORS',errors);console.log('ROUTE REQUESTS',routeRequests);throw Error('Condition timed out: '+expression)};
  await call('Network.enable');await call('Page.enable');await call('Runtime.enable');await call('Emulation.setDeviceMetricsOverride',{width:1440,height:1000,deviceScaleFactor:1,mobile:false});
  await call('Page.addScriptToEvaluateOnNewDocument',{source:`window.__visible=selector=>Array.from(document.querySelectorAll(selector)).find(n=>n.getClientRects().length&&getComputedStyle(n).visibility!=='hidden')`});
  qaName='uiauth_'+randomBytes(6).toString('hex');const password=randomBytes(24).toString('base64url');
  let r=await fetch(base+'/api/auth/register',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username:qaName,displayName:'Auth navigation QA',email:qaName+'@example.invalid',password})});assert.equal(r.status,201);qaId=(await r.json()).user.id;
  async function login() {
    await until(`location.pathname==='/' && window.__visible('.submit-button')?.disabled===false`);
    await js(`(()=>{for(const [id,value] of [['identifier',${JSON.stringify(qaName)}],['password',${JSON.stringify(password)}]]){const n=window.__visible('#'+id);Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(n,value);n.dispatchEvent(new Event('input',{bubbles:true}))}})()`);
    await js(`window.__visible('form').requestSubmit()`);
    try{await until(`location.pathname==='/home' && window.__visible('header [data-authenticated="true"]')`)}catch(e){console.log('LOGIN ERRORS',errors);console.log('SESSION',await js(`fetch('/api/auth/me').then(r=>r.status)`));console.log('HEADERS',await js(`Array.from(document.querySelectorAll('header [data-authenticated]')).map(n=>({value:n.dataset.authenticated,visible:!!n.getBoundingClientRect().width}))`));console.log('LOGIN DEBUG',await js(`({path:location.pathname,identifierLength:window.__visible('#identifier')?.value.length,passwordLength:window.__visible('#password')?.value.length,notices:Array.from(document.querySelectorAll('[role=alert],[role=status]')).map(n=>n.textContent),busy:window.__visible('.submit-button')?.disabled})`));throw e}
  }
  await call('Page.navigate',{url:base+'/'});await login();
  await js(`window.__authProbe='same-document';window.__visible('nav > a:last-child').click()`);await until(`location.pathname.startsWith('/profile/') && window.__visible('main h1')?.textContent==='Auth navigation QA'`);
  await js(`window.__visible('nav a[href="/home"]').click()`);await until(`location.pathname==='/home' && window.__visible('header button[aria-haspopup="dialog"]')`);
  await js(`window.__visible('header button[aria-haspopup="dialog"]').click()`);await until(`!!window.__visible('header [role="dialog"]')`);
  await js(`window.__visible('header [role="dialog"] button:last-of-type').click()`);await until(`location.pathname==='/home' && !!window.__visible('header [data-authenticated="false"]')`);
  assert.equal(await js(`fetch('/api/auth/me').then(r=>r.status)`),401);
  await js(`window.__visible('header a[href="/"]').click()`);await until(`location.pathname==='/'`);await wait(2200);
  const state=await js(`({path:location.pathname,form:!!window.__visible('#identifier'),probe:window.__authProbe,submitted:window.__visible('.login-stage')?.classList.contains('is-submitting')})`);console.log('AFTER LOGOUT -> LOGIN',state);assert.equal(state.path,'/');assert.equal(state.submitted,false);assert.equal(state.probe,'same-document');
  await js(`history.back()`);await until(`location.pathname==='/home'`);await js(`window.__visible('nav > a:last-child').click()`);await until(`location.pathname==='/'`);await wait(2200);assert.equal(await js(`location.pathname`),'/');assert.equal(await js(`window.__visible('#password').value`),'');
  console.log('SECOND LOGIN');await login();console.log('BEFORE SECOND PROFILE',await js(`({path:location.pathname,authenticated:window.__visible('header [data-authenticated]')?.dataset.authenticated})`));
  await js(`window.__visible('nav > a:last-child').click()`);await until(`location.pathname.startsWith('/profile/') && window.__visible('main h1')?.textContent==='Auth navigation QA'`);
  await js(`window.__visible('header button[aria-haspopup="dialog"]').click()`);await until(`!!window.__visible('header [role="dialog"]')`);await js(`window.__visible('header [role="dialog"] button:last-of-type').click()`);
  await until(`location.pathname==='/home' && !!window.__visible('header [data-authenticated="false"]')`);assert.equal(await js(`fetch('/api/auth/me').then(r=>r.status)`),401);
  await js(`window.__visible('nav > a:last-child').click()`);await until(`location.pathname==='/'`);await wait(2200);assert.equal(await js(`location.pathname`),'/');assert.equal(await js(`window.__visible('#password').value`),'');
  await login();assert.equal(await js(`window.__authProbe`),'same-document');
  console.log('PASS: logout from home/profile, login and cached protected-profile navigation work without reloading.');assert.equal(errors.length,0,JSON.stringify(errors));

 }finally{if(qaId){const db=await mysql.createConnection({host:process.env.DB_HOST,port:Number(process.env.DB_PORT),user:process.env.DB_USER,password:process.env.DB_PASSWORD,database:process.env.DB_NAME});try{await db.execute('DELETE FROM users WHERE id = ? AND username = ?',[qaId,qaName]);console.log('PASS: isolated account cleaned up.')}finally{await db.end()}}if(call)await call('Browser.close').catch(()=>{});ws?.close();proc.kill();assert.equal(path.dirname(profile),tempRoot);assert.ok(path.basename(profile).startsWith('recipe-auth-nav-'));try{fs.rmSync(profile,{recursive:true,force:true,maxRetries:10,retryDelay:100})}catch(error){if(!['EPERM','EBUSY','ENOTEMPTY'].includes(error.code))throw error;console.warn('Chrome temporary profile is still locked by Windows.')}}
})().catch(e=>{console.error(e.message);process.exitCode=1});
