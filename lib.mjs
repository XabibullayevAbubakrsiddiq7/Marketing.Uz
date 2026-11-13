import { DatabaseSync } from 'node:sqlite';
import { randomBytes, scryptSync, timingSafeEqual, createHash, createHmac } from 'node:crypto';
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
export const DB_PATH=resolve(process.env.DB_PATH||'./data/marketing.sqlite');
mkdirSync(dirname(DB_PATH),{recursive:true});
export const db=new DatabaseSync(DB_PATH);
db.exec(`PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;
 CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY, phone TEXT NOT NULL UNIQUE, username TEXT NOT NULL COLLATE NOCASE UNIQUE,
  password_hash TEXT NOT NULL, role TEXT NOT NULL CHECK(role IN ('seller','shop','admin')),
  bio TEXT NOT NULL DEFAULT '', avatar TEXT, banner TEXT, status TEXT NOT NULL DEFAULT 'active',
  shop_verified INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS otps(phone TEXT PRIMARY KEY,code_hash TEXT NOT NULL,expires_at INTEGER NOT NULL, attempts INTEGER NOT NULL DEFAULT 0);
 CREATE TABLE IF NOT EXISTS sessions(token_hash TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id),expires_at INTEGER NOT NULL);
 CREATE TABLE IF NOT EXISTS followings(follower_id TEXT NOT NULL REFERENCES users(id),followed_id TEXT NOT NULL REFERENCES users(id),created_at TEXT NOT NULL,PRIMARY KEY(follower_id,followed_id),CHECK(follower_id<>followed_id));
 CREATE TABLE IF NOT EXISTS consents(id TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id),version TEXT NOT NULL,role TEXT NOT NULL,text TEXT NOT NULL,agreed_at TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS certificates(id TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id),type TEXT NOT NULL,issued_at TEXT NOT NULL,revoked_at TEXT);
 CREATE TABLE IF NOT EXISTS audit_logs(id INTEGER PRIMARY KEY AUTOINCREMENT,actor_id TEXT,action TEXT NOT NULL,target_id TEXT,created_at TEXT NOT NULL,details TEXT NOT NULL DEFAULT '');
 CREATE TABLE IF NOT EXISTS rate_limits(key TEXT PRIMARY KEY,count INTEGER NOT NULL,reset_at INTEGER NOT NULL);
`);
export const consentVersion='2026-11-13-v2';
export const consentText={
 seller:'Men eʼlonlarimda va xabarlarimda yolgʻon maʼlumot bermayman, xaridorlarni aldamayman, tovarni ko‘rsatmasdan oldindan pul talab qilmayman va firibgarlikka urinmayman. Qoidabuzarlik holatida eʼlonim yoki akkauntim cheklanishi mumkin.',
 shop:'Men doʻkon nomidan mahsulot narxi, holati, mavjudligi va shartlari haqida toʻgʻri maʼlumot beraman. Xaridorlarni aldamayman, soxta mahsulot taklif qilmayman, tovarni ko‘rsatmasdan oldindan pul talab qilmayman va shikoyatlarni ko‘rib chiqishda hamkorlik qilaman. Qoidabuzarlik holatida doʻkonim cheklanishi mumkin.'
};
export const now=()=>new Date().toISOString();
export const id=()=>randomBytes(14).toString('hex');
export const sha=x=>createHash('sha256').update(x).digest('hex');
export function hashPassword(p){const salt=randomBytes(16).toString('hex');return salt+':'+scryptSync(p,salt,64).toString('hex');}
export function passwordCorrect(p,hash){try{const [salt,value]=hash.split(':');const actual=scryptSync(p,salt,64);const expected=Buffer.from(value,'hex');return actual.length===expected.length&&timingSafeEqual(actual,expected)}catch{return false}}
export function phone(v){let s=String(v||'').replace(/[\s()+.\-]/g,'');if(/^\d{9}$/.test(s))s='998'+s;if(!/^998\d{9}$/.test(s))throw Object.assign(new Error('Telefon raqami +998 formatida bo‘lishi kerak'),{status:400});return '+'+s}
export function validNick(v){return typeof v==='string'&&/^[a-zA-Z0-9_\-\[\]()\/]{3,30}$/.test(v)}
export function publicUser(u){return {id:u.id,username:u.username,role:u.role,bio:u.bio,avatar:u.avatar,banner:u.banner,shopVerified:!!u.shop_verified,createdAt:u.created_at}}
export function createAdmin(phoneValue,password,username){const p=phone(phoneValue);if(!validNick(username)||!password||password.length<12)throw Error('Username 3–30, parol 12+ belgili bo‘lsin');const existing=db.prepare('SELECT id FROM users WHERE phone=?').get(p);if(existing)throw Error('Bu raqam allaqachon ro‘yxatdan o‘tgan');const userId=id();db.prepare("INSERT INTO users (id,phone,username,password_hash,role,created_at) VALUES(?,?,?,?,?,?)").run(userId,p,username,hashPassword(password),'admin',now());return userId}
export function audit(actor,action,target='',details=''){db.prepare('INSERT INTO audit_logs(actor_id,action,target_id,created_at,details) VALUES(?,?,?,?,?)').run(actor,action,target,now(),String(details).slice(0,300))}
export function limit(key,max,windowMs){const t=Date.now();const row=db.prepare('SELECT count,reset_at FROM rate_limits WHERE key=?').get(key);if(!row||row.reset_at<t){db.prepare('INSERT INTO rate_limits(key,count,reset_at) VALUES(?,?,?) ON CONFLICT(key) DO UPDATE SET count=excluded.count,reset_at=excluded.reset_at').run(key,1,t+windowMs);return;}if(row.count>=max)throw Object.assign(new Error('Juda ko‘p urinish. Keyinroq qayta urinib ko‘ring.'),{status:429});db.prepare('UPDATE rate_limits SET count=count+1 WHERE key=?').run(key)}
export function otpHash(p,c){return createHmac('sha256',process.env.OTP_SECRET||'dev-only-change-me').update(p+':'+c).digest('hex')}
