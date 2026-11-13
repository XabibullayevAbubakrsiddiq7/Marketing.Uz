import http from 'node:http';
import {readFileSync,existsSync,mkdirSync,writeFileSync} from 'node:fs';
import {resolve,extname,join} from 'node:path';
import {randomInt,randomBytes,timingSafeEqual} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {db,consentVersion,consentText,now,id,sha,hashPassword,passwordCorrect,phone,validNick,publicUser,audit,limit,otpHash} from './lib.mjs';
import {categories,regions,adminLevel,isAdmin,isOwner,adminCount,changeAdmin,listAdmins,browseListings,ownerListings,listingById,addListing,changeListing,toggleFavorite,userFavorites,reportListing,priceStats,luhnIMEI} from './market.mjs';

const PORT=Number(process.env.PORT)||3000;
const ROOT=resolve('public'), UPLOADS=resolve('uploads');mkdirSync(UPLOADS,{recursive:true});
const prod=process.env.NODE_ENV==='production';
const demoReadOnly=process.env.PUBLIC_DEMO_READONLY==='1';
if(prod && !demoReadOnly && (!process.env.OTP_SECRET || process.env.OTP_SECRET.length<32))throw Error('Production uchun OTP_SECRET (32+ belgi) kerak');
if(prod && !demoReadOnly && !process.env.SMS_WEBHOOK_URL)throw Error('Production uchun SMS_WEBHOOK_URL kerak; mock OTP ni ommaga chiqarmang');
const send=(res,status,body,headers={})=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff',...headers});res.end(JSON.stringify(body))};
const problem=(res,status,message)=>send(res,status,{error:message});
const cookie=(req,name)=>{const m=(req.headers.cookie||'').match(new RegExp('(?:^|;\\s*)'+name+'=([^;]*)'));return m?.[1]};
const sessionCookie=(value,clear=false)=>`bz_session=${value}; Path=/; HttpOnly; SameSite=Lax; ${prod?'Secure; ':''}${clear?'Max-Age=0':'Max-Age=2592000'}`;
function userFromReq(req){const token=cookie(req,'bz_session');if(!token)return null;const r=db.prepare('SELECT users.* FROM sessions JOIN users ON users.id=sessions.user_id WHERE token_hash=? AND expires_at>?').get(sha(token),Date.now());return r?.status==='active'?r:null}
function auth(u){if(!u)throw Object.assign(new Error('Avval akkauntga kiring'),{status:401});return u}
function admin(u){auth(u);if(!isAdmin(u.id))throw Object.assign(new Error('Faqat admin uchun'),{status:403});return u}
async function body(req){const chunks=[];let size=0;for await(const c of req){size+=c.length;if(size>5_000_000)throw Object.assign(new Error('Fayl yoki so‘rov juda katta'),{status:413});chunks.push(c)}try{return JSON.parse(Buffer.concat(chunks).toString('utf8')||'{}')}catch{throw Object.assign(new Error('JSON noto‘g‘ri'),{status:400})}}
function createSession(res,user){const token=randomBytes(32).toString('hex');db.prepare('INSERT INTO sessions VALUES(?,?,?)').run(sha(token),user.id,Date.now()+30*864e5);return sessionCookie(token)}
function csvNumber(n){return Number(n)||0}
function getProfile(userId,viewer){const u=db.prepare("SELECT * FROM users WHERE id=? AND status='active' AND role!='admin'").get(userId);if(!u)return null;const counts=db.prepare('SELECT (SELECT count(*) FROM followings WHERE followed_id=?) AS followers,(SELECT count(*) FROM followings WHERE follower_id=?) AS following').get(userId,userId);const cert=db.prepare('SELECT id,type,issued_at FROM certificates WHERE user_id=? AND revoked_at IS NULL ORDER BY issued_at DESC LIMIT 1').get(userId);const isFollowing=!!viewer&&!!db.prepare('SELECT 1 FROM followings WHERE follower_id=? AND followed_id=?').get(viewer.id,userId);return {...publicUser(u),...counts,isFollowing,certificate:cert||null}}
function saveImage(input,owner,kind){if(input===null)return null;if(typeof input!=='string')throw Object.assign(new Error('Rasm formati noto‘g‘ri'),{status:400});const m=/^data:image\/(png|jpeg|webp);base64,([a-zA-Z0-9+/=]+)$/.exec(input);if(!m)throw Object.assign(new Error('PNG, JPEG yoki WebP rasm tanlang'),{status:400});const data=Buffer.from(m[2],'base64');if(data.length>(kind==='banner'?3_000_000:kind==='listing'?2_000_000:1_500_000))throw Object.assign(new Error('Rasm juda katta'),{status:413});const valid=m[1]==='png'?data.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])):m[1]==='jpeg'?data.subarray(0,3).equals(Buffer.from([255,216,255])):data.toString('ascii',0,4)==='RIFF'&&data.toString('ascii',8,12)==='WEBP';if(!valid)throw Object.assign(new Error('Rasm fayli tekshiruvdan o‘tmadi'),{status:400});const ext={png:'png',jpeg:'jpg',webp:'webp'}[m[1]];const name=`${owner}-${kind}-${id()}.${ext}`;writeFileSync(join(UPLOADS,name),data,{flag:'wx'});return '/uploads/'+name}
function serveStatic(res,requested){const safe=requested==='/'?'index.html':requested.replace(/^\//,'');if(safe.includes('..')||safe.includes('\\'))return problem(res,404,'Topilmadi');const path=resolve(ROOT,safe);if(!path.startsWith(ROOT+'/')&&!path.startsWith(UPLOADS+'/'))return problem(res,404,'Topilmadi');if(!existsSync(path))return problem(res,404,'Topilmadi');const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.webp':'image/webp'}[extname(path)]||'application/octet-stream';res.writeHead(200,{'Content-Type':mime,'X-Content-Type-Options':'nosniff','Content-Security-Policy':"default-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src 'self'; base-uri 'none'; frame-ancestors 'none'"});res.end(readFileSync(path))}
async function route(req,res){
 const url=new URL(req.url,`http://${req.headers.host||'localhost'}`);const path=url.pathname;
 if(req.method==='GET' && path==='/health')return send(res,200,{status:'ok'});
 if(req.method==='GET' && path==='/api/config')return send(res,200,{consentVersion,consentText,smsConfigured:!!process.env.SMS_WEBHOOK_URL,categories,regions,site:'Marketing.Uz',readOnlyDemo:demoReadOnly});
 if(req.method==='GET' && path==='/api/me'){const u=userFromReq(req);return send(res,200,{user:u?{...publicUser(u),phone:u.phone,adminAccess:isAdmin(u.id),adminLevel:adminLevel(u.id)}:null})}
 if(req.method==='GET' && path==='/api/users'){const viewer=userFromReq(req);const search=(url.searchParams.get('q')||'').trim().slice(0,30);const users=db.prepare("SELECT id FROM users WHERE role!='admin' AND status='active' AND instr(lower(username),lower(?))>0 ORDER BY created_at DESC LIMIT 80").all(search);return send(res,200,{users:users.map(u=>getProfile(u.id,viewer))})}
 const profileMatch=path.match(/^\/api\/users\/([a-f0-9]{28})$/);if(req.method==='GET'&&profileMatch){const p=getProfile(profileMatch[1],userFromReq(req));return p?send(res,200,{profile:p}):problem(res,404,'Profil topilmadi')}
 const certMatch=path.match(/^\/api\/certificates\/([a-f0-9]{28})$/);if(req.method==='GET'&&certMatch){const cert=db.prepare("SELECT c.*,u.username,u.role,u.shop_verified,u.status FROM certificates c JOIN users u ON u.id=c.user_id WHERE c.id=?").get(certMatch[1]);return cert?send(res,200,{certificate:{id:cert.id,username:cert.username,type:cert.type,issuedAt:cert.issued_at,valid:!cert.revoked_at&&cert.status==='active',shopVerified:!!cert.shop_verified,note:'Shartlarga rozilikni bildiradi; foydalanuvchi ishonchliligini kafolatlamaydi.'}}):problem(res,404,'Sertifikat topilmadi')}
 if(req.method==='GET' && path.startsWith('/uploads/')){return serveUpload(res,path)}
 if(req.method==='GET'&&path==='/api/listings')return send(res,200,{listings:browseListings({q:url.searchParams.get('q')||'',category:url.searchParams.get('category')||'',brand:url.searchParams.get('brand')||'',region:url.searchParams.get('region')||''},userFromReq(req)?.id)});
 if(req.method==='GET'&&path==='/api/my/listings'){const u=auth(userFromReq(req));return send(res,200,{listings:ownerListings(u.id)});}
 if(req.method==='GET'&&path==='/api/my/favorites'){const u=auth(userFromReq(req));return send(res,200,{listings:userFavorites(u)});}
 if(req.method==='GET'&&path==='/api/market/price-stats')return send(res,200,priceStats(url.searchParams.get('category'),url.searchParams.get('model')));
 const listingGet=path.match(/^\/api\/listings\/([a-f0-9]{28})$/);if(req.method==='GET'&&listingGet){const row=listingById(listingGet[1],userFromReq(req)?.id);return row?send(res,200,{listing:row}):problem(res,404,'E’lon topilmadi');}
 
 const qrMatch=path.match(/^\/qr\/([a-f0-9]{28})$/);
 if(req.method==='GET' && qrMatch){
  const cert=db.prepare('SELECT id FROM certificates WHERE id=?').get(qrMatch[1]);if(!cert)return problem(res,404,'Sertifikat topilmadi');
  const base=(process.env.PUBLIC_BASE_URL||`http://localhost:${PORT}`).replace(/\/$/,'');
  const qr=spawnSync('python3',[resolve('scripts/qr.py'),`${base}/verify/${cert.id}`],{timeout:4000,maxBuffer:200000});
  if(qr.status!==0)return problem(res,503,'QR generatori mavjud emas');
  res.writeHead(200,{'Content-Type':'image/svg+xml; charset=utf-8','Cache-Control':'public,max-age=300','X-Content-Type-Options':'nosniff','Content-Security-Policy':"default-src 'none'; style-src 'unsafe-inline'"});return res.end(qr.stdout);
 }
 if(req.method==='GET' && /^\/verify\/[a-f0-9]{28}$/.test(path))return serveStatic(res,'/index.html');
 if(req.method==='GET' && (path==='/'||path==='/index.html'||path==='/app.js'||path==='/style.css'||path==='/marketing-logo.webp'))return serveStatic(res,path);
 if(req.method!=='POST')return problem(res,404,'Sahifa topilmadi');
 if(demoReadOnly)return problem(res,503,'Bu xavfsiz sinov versiyasi. Akkaunt, IMEI va e’lon kiritish internetda vaqtincha o‘chirilgan.');
 const origin=req.headers.origin;if(origin && new URL(origin).host!==req.headers.host)throw Object.assign(new Error('Noto‘g‘ri manba'),{status:403});
 const b=await body(req);const u=userFromReq(req);const ip=(req.socket.remoteAddress||'').slice(0,80);
 if(path==='/api/auth/request-code'){
  limit('otp-ip:'+ip,12,3600000);const p=phone(b.phone);limit('otp-phone:'+p,3,10*60000);
  if(prod&&!process.env.SMS_WEBHOOK_URL)throw Object.assign(new Error('SMS xizmati ulanmagan'),{status:503});
  const c=String(randomInt(100000,999999));db.prepare('INSERT INTO otps(phone,code_hash,expires_at,attempts) VALUES(?,?,?,0) ON CONFLICT(phone) DO UPDATE SET code_hash=excluded.code_hash,expires_at=excluded.expires_at,attempts=0').run(p,otpHash(p,c),Date.now()+300000);
  if(process.env.SMS_WEBHOOK_URL){let r=await fetch(process.env.SMS_WEBHOOK_URL,{method:'POST',headers:{'Content-Type':'application/json','Authorization':`Bearer ${process.env.SMS_WEBHOOK_TOKEN||''}`},body:JSON.stringify({phone:p,message:`Marketing.Uz tasdiqlash kodi: ${c}. 5 daqiqa amal qiladi.`})});if(!r.ok)throw Object.assign(new Error('SMS yuborilmadi'),{status:502});}
  else console.log(`LOCAL DEMO OTP (${p}): ${c}`);
  return send(res,200,{ok:true,message:process.env.SMS_WEBHOOK_URL?'SMS yuborildi':'Namuna rejimi: kod server terminalida chiqadi'});
 }
 if(path==='/api/auth/register'){
  limit('register:'+ip,15,3600000);const p=phone(b.phone);const nick=String(b.username||'').trim();
  if(!validNick(nick))throw Object.assign(new Error('Nikda faqat harflar, raqamlar va _ - [ ] ( ) / belgilariga ruxsat, 3–30 belgi'),{status:400});
  if(!['seller','shop'].includes(b.role))throw Object.assign(new Error('Akkaunt turini tanlang'),{status:400});
  if(typeof b.password!=='string'||b.password.length<10||b.password.length>128)throw Object.assign(new Error('Parol 10–128 belgi bo‘lishi kerak'),{status:400});
  if(b.consent!==true || b.consentVersion!==consentVersion)throw Object.assign(new Error('Amaldagi shartlarga rozilik kerak'),{status:400});
  const ot=db.prepare('SELECT * FROM otps WHERE phone=?').get(p);if(!ot||ot.expires_at<Date.now()||ot.attempts>=5)throw Object.assign(new Error('Telefon kodi eskirgan yoki topilmadi'),{status:400});
  db.prepare('UPDATE otps SET attempts=attempts+1 WHERE phone=?').run(p);
  const actual=otpHash(p,String(b.code||''));if(!timingSafeEqual(Buffer.from(ot.code_hash),Buffer.from(actual)))throw Object.assign(new Error('Telefon kodi noto‘g‘ri'),{status:400});
  if(db.prepare('SELECT 1 FROM users WHERE phone=? OR username=?').get(p,nick))throw Object.assign(new Error('Telefon yoki nickname band'),{status:409});
  const userId=id(),t=now();db.exec('BEGIN IMMEDIATE');try{
   db.prepare('INSERT INTO users (id,phone,username,password_hash,role,created_at) VALUES(?,?,?,?,?,?)').run(userId,p,nick,hashPassword(b.password),b.role,t);
   db.prepare('INSERT INTO consents(id,user_id,version,role,text,agreed_at) VALUES(?,?,?,?,?,?)').run(id(),userId,consentVersion,b.role,consentText[b.role],t);
   db.prepare('INSERT INTO certificates(id,user_id,type,issued_at) VALUES(?,?,?,?)').run(id(),userId,b.role,t);
   db.prepare('DELETE FROM otps WHERE phone=?').run(p);db.exec('COMMIT');
  }catch(e){db.exec('ROLLBACK');throw e}
  audit(userId,'register',userId,b.role);return send(res,201,{ok:true,user:getProfile(userId,null)},{'Set-Cookie':createSession(res,{id:userId})});
 }
 if(path==='/api/auth/login'){
  limit('login:'+ip,25,10*60000);const p=phone(b.phone);const found=db.prepare('SELECT * FROM users WHERE phone=?').get(p);
  if(!found||!passwordCorrect(String(b.password||''),found.password_hash)||found.status!=='active')throw Object.assign(new Error('Telefon yoki parol xato, yoxud akkaunt cheklangan'),{status:401});
  if(isAdmin(found.id)){
   const secret=process.env.ADMIN_TOTP_SECRET;
   if(prod&&!secret)throw Object.assign(new Error('Admin uchun ADMIN_TOTP_SECRET shart'),{status:503});
   if(secret&&!verifyTotp(secret,String(b.totp||'')))throw Object.assign(new Error('Admin 2FA kodi noto‘g‘ri'),{status:401});
  }
  audit(found.id,'login',found.id);return send(res,200,{ok:true,user:{...publicUser(found),phone:found.phone,adminAccess:isAdmin(found.id),adminLevel:adminLevel(found.id)}},{'Set-Cookie':createSession(res,found)});
 }
 if(path==='/api/auth/logout'){const token=cookie(req,'bz_session');if(token)db.prepare('DELETE FROM sessions WHERE token_hash=?').run(sha(token));return send(res,200,{ok:true},{'Set-Cookie':sessionCookie('',true)})}
 if(path==='/api/me/profile'){
  auth(u);let bio=String(b.bio||'').trim();if(bio.length>400)throw Object.assign(new Error('Tavsif 400 belgidan oshmasin'),{status:400});
  let avatar=u.avatar,banner=u.banner;
  if(Object.hasOwn(b,'avatar'))avatar=saveImage(b.avatar,u.id,'avatar');
  if(Object.hasOwn(b,'banner'))banner=saveImage(b.banner,u.id,'banner');
  db.prepare('UPDATE users SET bio=?,avatar=?,banner=? WHERE id=?').run(bio,avatar,banner,u.id);audit(u.id,'profile-edit',u.id);return send(res,200,{ok:true,profile:getProfile(u.id,u)});
 }
 const follow=path.match(/^\/api\/users\/([a-f0-9]{28})\/follow$/);
 if(follow){auth(u);if(u.id===follow[1])throw Object.assign(new Error('O‘zingizga obuna bo‘lolmaysiz'),{status:400});
  const target=db.prepare("SELECT id FROM users WHERE id=? AND status='active' AND role!='admin'").get(follow[1]);if(!target)throw Object.assign(new Error('Profil topilmadi'),{status:404});
  const existing=db.prepare('SELECT 1 FROM followings WHERE follower_id=? AND followed_id=?').get(u.id,follow[1]);
  if(existing)db.prepare('DELETE FROM followings WHERE follower_id=? AND followed_id=?').run(u.id,follow[1]);else db.prepare('INSERT INTO followings VALUES(?,?,?)').run(u.id,follow[1],now());
  return send(res,200,{ok:true,following:!existing,profile:getProfile(follow[1],u)});
 }

 if(path==='/api/market/listings/create'){auth(u);const listing=addListing(u,b);return send(res,201,{ok:true,listing});}
 if(path==='/api/market/image'){auth(u);const image=saveImage(b.image,u.id,'listing');return send(res,201,{image});}
 const listingStatus=path.match(/^\/api\/market\/listings\/([a-f0-9]{28})\/status$/);
 if(listingStatus){auth(u);return send(res,200,{ok:true,listing:changeListing(u,listingStatus[1],b)});}
 const listingFav=path.match(/^\/api\/market\/listings\/([a-f0-9]{28})\/favorite$/);
 if(listingFav){auth(u);return send(res,200,{ok:true,favorite:toggleFavorite(u,listingFav[1])});}
 const listingReport=path.match(/^\/api\/market\/listings\/([a-f0-9]{28})\/report$/);
 if(listingReport){auth(u);return send(res,201,{ok:true,id:reportListing(u,listingReport[1],b.reason)});}
 if(path==='/api/market/support'){auth(u);const subject=String(b.subject||'').trim(),msg=String(b.message||'').trim();if(subject.length<4||subject.length>120||msg.length<20||msg.length>1500)throw Object.assign(new Error('Mavzu 4–120 belgi, murojaat 20–1500 belgi bo‘lsin'),{status:400});limit('support:'+u.id,5,86400000);db.prepare('INSERT INTO support_tickets(id,user_id,subject,message,created_at) VALUES(?,?,?,?,?)').run(id(),u.id,subject,msg,now());return send(res,201,{ok:true});}
 if(path==='/api/admin/roles'){admin(u);return send(res,200,{owner:isOwner(u.id),count:adminCount(),roles:listAdmins()});}
 if(path==='/api/admin/roles/change'){admin(u);if(!isOwner(u.id))throw Object.assign(new Error('Faqat loyiha egasi admin huquqini boshqaradi'),{status:403});if(typeof b.active!=='boolean')throw Object.assign(new Error('active true/false bo‘lsin'),{status:400});return send(res,200,{ok:true,...changeAdmin(u.id,String(b.userId||''),b.active)});}
 if(path==='/api/admin/reports'){admin(u);const reports=db.prepare('SELECT r.id,r.reason,r.status,r.created_at,u.username,l.title FROM reports r JOIN users u ON u.id=r.reporter_id JOIN listings l ON l.id=r.listing_id ORDER BY r.created_at DESC LIMIT 100').all();return send(res,200,{reports});}
 if(path==='/api/admin/summary'){admin(u);const users=db.prepare("SELECT count(*) n FROM users WHERE role!='admin'").get().n;const shops=db.prepare("SELECT count(*) n FROM users WHERE role='shop' AND shop_verified=0").get().n;const followed=db.prepare('SELECT count(*) n FROM followings').get().n;return send(res,200,{users,unverifiedShops:shops,follows:followed})}
 if(path==='/api/admin/users'){admin(u);const users=db.prepare("SELECT id,username,phone,role,status,shop_verified,created_at FROM users ORDER BY created_at DESC LIMIT 150").all();return send(res,200,{users})}
 const verify=path.match(/^\/api\/admin\/users\/([a-f0-9]{28})\/verify-shop$/);
 if(verify){admin(u);const t=db.prepare("SELECT * FROM users WHERE id=? AND role='shop'").get(verify[1]);if(!t)throw Object.assign(new Error('Do‘kon topilmadi'),{status:404});if(typeof b.verified!=='boolean')throw Object.assign(new Error('verified true/false kiriting'),{status:400});db.prepare('UPDATE users SET shop_verified=? WHERE id=?').run(b.verified?1:0,t.id);audit(u.id,'shop-verification',t.id,String(b.verified));return send(res,200,{ok:true})}
 const status=path.match(/^\/api\/admin\/users\/([a-f0-9]{28})\/status$/);
 if(status){admin(u);if(!['active','blocked'].includes(b.status))throw Object.assign(new Error('Status xato'),{status:400});if(isAdmin(status[1]))throw Object.assign(new Error('Admin akkauntini bloklashdan oldin loyiha egasi rolini olib tashlashi kerak'),{status:403});db.prepare('UPDATE users SET status=? WHERE id=?').run(b.status,status[1]);if(b.status==='blocked'){db.prepare('DELETE FROM sessions WHERE user_id=?').run(status[1]);db.prepare('UPDATE certificates SET revoked_at=? WHERE user_id=? AND revoked_at IS NULL').run(now(),status[1])}audit(u.id,'status',status[1],b.status);return send(res,200,{ok:true})}
 return problem(res,404,'So‘rov topilmadi');
}
function verifyTotp(secret,code){if(!/^\d{6}$/.test(code))return false;const alphabet='ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';let bits='';for(const c of secret.toUpperCase().replace(/=+$/,'')){const i=alphabet.indexOf(c);if(i<0)return false;bits+=i.toString(2).padStart(5,'0')}let hex='';for(let i=0;i+8<=bits.length;i+=8)hex+=parseInt(bits.slice(i,i+8),2).toString(16).padStart(2,'0');const key=Buffer.from(hex,'hex');for(let d=-1;d<=1;d++){const counter=Buffer.alloc(8);counter.writeBigUInt64BE(BigInt(Math.floor(Date.now()/30000)+d));const hmac=awaitlessHmac(key,counter);const index=hmac[hmac.length-1]&15;const n=(hmac.readUInt32BE(index)&0x7fffffff)%1000000;if(String(n).padStart(6,'0')===code)return true}return false}
import {createHmac} from 'node:crypto';
function awaitlessHmac(key,counter){return createHmac('sha1',key).update(counter).digest()}
function serveUpload(res,path){if(!/^\/uploads\/[a-f0-9]{28}-(avatar|banner|listing)-[a-f0-9]{28}\.(png|jpg|webp)$/.test(path))return problem(res,404,'Rasm topilmadi');const name=path.slice(9);const file=join(UPLOADS,name);if(!existsSync(file))return problem(res,404,'Rasm topilmadi');const mimetype=file.endsWith('.jpg')?'image/jpeg':file.endsWith('.png')?'image/png':'image/webp';res.writeHead(200,{'Content-Type':mimetype,'X-Content-Type-Options':'nosniff','Cache-Control':'public,max-age=86400'});res.end(readFileSync(file))}
const server=http.createServer((req,res)=>{route(req,res).catch(err=>{console.error('Request error:',err.message);const code=err.status||(/UNIQUE constraint failed/.test(err.message)?409:500);problem(res,code,code===500?'Server xatosi':err.message)})});
server.listen(PORT,'0.0.0.0',()=>console.log(`Marketing.Uz local v2: http://localhost:${PORT}`));
