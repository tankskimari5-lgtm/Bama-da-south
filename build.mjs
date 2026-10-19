import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import zlib from 'node:zlib';

const parts=[
  'source/production-v3.3.br.b64.part01',
  'source/production-v3.3.br.b64.part02'
];
const compressed=Buffer.from(parts.map(file=>fs.readFileSync(file,'utf8').trim()).join(''),'base64');
const original=zlib.brotliDecompressSync(compressed);
const hash=crypto.createHash('sha256').update(original).digest('hex');
const expectedHash='7906edfcf1fd78a3edcf4f4e079f53f8715cd911d8d62115993e86dc97cdd86b';
if(hash!==expectedHash || original.length!==122197) {
  throw new Error('Production source integrity check failed: SHA-256 '+hash+' bytes '+original.length);
}
let html=original.toString('utf8');
if(process.env.BAMA_AUDIO_UPGRADE==='1') {
  const patch=fs.readFileSync('src/trunk-audio-patch.html','utf8');
  const anchor='</body>';
  if(!html.includes(anchor))throw new Error('Bama source changed: body insertion anchor missing');
  html=html.replace(anchor,patch+'\n'+anchor);
}
fs.mkdirSync('dist',{recursive:true});
fs.writeFileSync('dist/index.html',html);
if(process.argv.includes('--unpack')) {
  fs.mkdirSync('recovered',{recursive:true});
  fs.writeFileSync('recovered/index.html',original);
}
console.log('Bama Da South V3.3 restored, SHA-256 '+hash+' ('+original.length+' original bytes).');
console.log('Built dist/index.html ('+Buffer.byteLength(html)+' bytes).');
