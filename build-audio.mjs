import fs from 'node:fs';
import './build.mjs';

let html=fs.readFileSync('dist/index.html','utf8');
function patch(source,anchor,content,label){
 const first=source.indexOf(anchor);
 if(first<0 || source.indexOf(anchor,first+1)>=0){
  throw Error('Unable to safely patch '+label+'; anchor absent or repeated.');
 }
 return source.replace(anchor,content);
}
const makeCarData=fs.readFileSync('src/car-trunk-insert.js.txt','utf8');
const radio=fs.readFileSync('src/radio-module-insert.js.txt','utf8');
const ui=fs.readFileSync('src/radio-controls.html','utf8');
html=patch(html,
 ' root.userData={body:paint,wheels,hubs,spoiler',
 makeCarData+'\n root.userData={body:paint,wheels,hubs,spoiler',
 'car 3D speaker meshes');
html=patch(html,
 ' return root;\n}\n\nfunction createWorld(scene)',
 ' root.userData.bamaCones=bamaCones;root.userData.bamaTrunk=bamaTrunk;\n return root;\n}\n\nfunction createWorld(scene)',
 'speaker model data');
html=patch(html,
 'function frame(t){requestAnimationFrame(frame);const dt=',
 radio+'\nfunction frame(t){requestAnimationFrame(frame);const dt=',
 'audio controller');
html=patch(html,
 'if(!world)return;if(started&&!paused)',
 'if(!world)return;__bamaBassStep(t);if(started&&!paused)',
 'per-frame animation');
html=patch(html,'</body>',ui+'</body>','mobile radio controls');
fs.writeFileSync('dist/index.html',html);
console.log('Bama bass-reactive edition built:',Buffer.byteLength(html),'bytes');
