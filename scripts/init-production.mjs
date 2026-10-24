import fs from 'node:fs'
import path from 'node:path'
import {randomBytes,X509Certificate} from 'node:crypto'
import {execFileSync} from 'node:child_process'
import {fileURLToPath} from 'node:url'
import {parseEnv} from 'node:util'
const root=new URL('..',import.meta.url),secrets=new URL('../.secrets/',import.meta.url)
fs.mkdirSync(secrets,{recursive:true})
const target=new URL('mysql_app_password.txt',secrets)
if(!fs.existsSync(target)){
  const envPath=new URL('../app/.env.local',import.meta.url)
  const env=fs.existsSync(envPath)?parseEnv(fs.readFileSync(envPath,'utf8')):{}
  if(env.DB_USER && env.DB_USER!=='recipe_app')throw Error('Existing DB_USER is not recipe_app; confirm the production runtime account before initialization.')
  fs.writeFileSync(target,env.DB_PASSWORD||randomBytes(32).toString('hex'),{mode:0o600})
  console.log('Created local application DB secret; no password was printed.')
}
const tls=new URL('tls/',secrets)
fs.mkdirSync(tls,{recursive:true})
const cert=new URL('localhost.crt',tls),key=new URL('localhost.key',tls)
if(fs.existsSync(cert)!==fs.existsSync(key))throw Error('TLS key/certificate pair is incomplete; existing files were preserved.')
if(!fs.existsSync(cert)){
  const gitOpenSSL=path.join(process.env.ProgramFiles||'C:/Program Files','Git','usr','bin','openssl.exe')
  const openssl=process.env.OPENSSL_PATH||(process.platform==='win32'&&fs.existsSync(gitOpenSSL)?gitOpenSSL:'openssl')
  execFileSync(openssl,['req','-x509','-newkey','rsa:2048','-sha256','-nodes','-days','365','-keyout',fileURLToPath(key),'-out',fileURLToPath(cert),'-subj','/CN=localhost','-addext','subjectAltName=DNS:localhost,IP:127.0.0.1,IP:::1'],{cwd:root,stdio:'pipe'})
  console.log('Created a local self-signed localhost certificate; system trust was not changed.')
}
const certificate=new X509Certificate(fs.readFileSync(cert))
if(!certificate.checkHost('localhost')||Date.parse(certificate.validTo)<=Date.now())throw Error('Existing TLS certificate is invalid/expired; files were preserved.')
console.log('Production configuration is ready. Existing secrets and certificates were preserved.')
