import {grantOwnerCLI} from '../market.mjs';
import {phone} from '../lib.mjs';
const p=process.env.OWNER_PHONE;
if(!p)throw Error('OWNER_PHONE=+998... ni kiriting. Faqat ro‘yxatdan o‘tgan o‘z akkauntingiz uchun.');
console.log('Loyiha egasi tayinlandi:',grantOwnerCLI(phone(p)));
