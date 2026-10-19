import fs from 'node:fs';
import './build.mjs';
let html=fs.readFileSync('dist/index.html','utf8');
function patch(a,b,label){
 const i=html.indexOf(a);
 if(i<0||(html.indexOf(a,i+1)!==-1 && label!=='garage menu audio purchase'))throw Error('Unsafe '+label+' patch (anchor absent or unexpectedly duplicated)');
 html=html.replace(a,b);
}
function patchRange(start,end,replacement,label){
 const a=html.indexOf(start);if(a<0)throw Error(label+' start missing');
 const b=html.indexOf(end,a+start.length);if(b<0)throw Error(label+' end missing');
 html=html.slice(0,a)+replacement+html.slice(b);
}
const car=fs.readFileSync('src/box-car-geometry.txt','utf8');
const audio=fs.readFileSync('src/box-radio-controller.txt','utf8');
const shop=fs.readFileSync('src/box-paid-shop.txt','utf8');
const ui=fs.readFileSync('src/box-car-hud.html','utf8');
patchRange('const CAR_CATALOG=[','\n\nreturn {ROAD,LIMIT,DISTRICTS',
  "const CAR_CATALOG=[{name:'Bama Box Chevy',price:0,color:0x686a6b,description:'Classic 1980s four-door box Chevy • only available car'}];",
  'catalog');
patchRange('const CAR_SPECS=[','\nfunction sculptedPanel(',
  "const CAR_SPECS=[\n {name:'Bama Box Chevy',price:0,type:'classic',length:5.30,width:2.13,roof:2.08,cabStart:-1.25,cabEnd:1.43,frontAxle:-1.55,rearAxle:1.65,wheelRadius:.50,accel:12.9,top:29,turn:1.18,brake:20.0,paint:0x686a6b,desc:'Four-door, old-school chrome body'}\n];",
  'car specifications');
patch('function sculptedPanel(parent,rings,material){',
      'function sculptedPanel(parent,rings,material,cutEnds=false){',
      'open top surface');
patch('for(let j=0;j<4;j++){const k=(j+1)%4;quad(a[j],a[k],b[k],b[j])}',
      'for(let j=0;j<4;j++){if(cutEnds&&j===2&&(i<=2||i>=4))continue;const k=(j+1)%4;quad(a[j],a[k],b[k],b[j])}',
      'hood and trunk cavities');
patch('sculptedPanel(shell,contours,paint);',
      'sculptedPanel(shell,contours,paint,true);',
      'removable hood/trunk cutouts');
patch(' root.userData={body:paint,wheels,hubs,spoiler',
      car+'\n root.userData={body:paint,wheels,hubs,spoiler',
      'body hinges and speakers');
patch(' return root;\n}\n\nfunction createWorld(scene)',
      ' root.userData.hoodHinge=hoodHinge;root.userData.trunkHinge=trunkHinge;root.userData.engineFan=engineFan;root.userData.hoodTarget=0;root.userData.trunkTarget=0;root.userData.audioKits=audioKits;root.userData.audioCones=audioCones;\n return root;\n}\n\nfunction createWorld(scene)',
      'runtime vehicle controls');
patch('const traffic=[];for(let i=0;i<20;i++){',
      'const traffic=[];for(let i=0;i<0;i++){',
      'remove all other traffic vehicles');
patch("cars:['Starter Sedan'],carModel:0,carPaint:0x262f35",
      "cars:['Bama Box Chevy'],carModel:0,carPaint:0x686a6b,audioKit:null",
      'stock car and empty audio');
patch("'brakeLevel','handlingLevel','carFinish'];",
      "'brakeLevel','handlingLevel','carFinish','audioKit'];",
      'save purchased audio with vehicle');
patch('const S=load(),nav=new Navigator();',
      "const S=load(),nav=new Navigator();S.carModel=0;S.cars=['Bama Box Chevy'];if(!['dual','quad','premium'].includes(S.audioKit))S.audioKit=null;",
      'migrate existing saves');
patchRange(' function dealership(){',' function setRims(',
      " function dealership(){modal('BAMA MOTORS','The Bama Box Chevy is currently the only vehicle in the game.',[{text:'Bama Box Chevy',note:'OWNED',disabled:true}], 'New cars will arrive in later updates.')}\n",
      'disable car dealership purchases');
patch(' function garage(){modal(',
      shop+' function garage(){modal(',
      'install shop');
patch("  {text:'Repair vehicle body and drivetrain'",
      "  {text:'TRUNK AUDIO • BUY & INSTALL',note:S.audioKit?S.audioKit.toUpperCase()+' INSTALLED':'FROM $950',run:bamaAudioShop},\n  {text:'Repair vehicle body and drivetrain'",
      'garage menu audio purchase');
patch("  {text:'Browse Bama Motors vehicles',note:'SHOWROOM',run:dealership}",
      "  {text:'Your only car: Bama Box Chevy',note:'OWNED',disabled:true,run:()=>{}}",
      'remove old car catalog from garage');
patch(" c.spoiler.visible=c.spec.type==='sport'||(S.engineLevel||0)>=2;\n world.car.position.y=(S.carSuspension||0)*.11;",
      " c.spoiler.visible=false;\n world.car.position.y=(S.carSuspension||0)*.11;bamaApplyAudioKit();",
      'apply installed audio to car model');
patch('function frame(t){requestAnimationFrame(frame);const dt=',
      audio+'\nfunction frame(t){requestAnimationFrame(frame);const dt=',
      'hinge and bass controls');
patch('if(!world)return;if(started&&!paused)',
      'if(!world)return;bamaAudioStep(t,dt);if(started&&!paused)',
      'per-frame speaker and hinge animation');
patch('function enterCar(){driving=true;',
      'function enterCar(){if(world?.car?.userData){world.car.userData.hoodTarget=0;world.car.userData.trunkTarget=0}driving=true;',
      'close panels before driving');
patch('</body>',ui+'\n</body>','mobile open hood/trunk buttons');
fs.writeFileSync('dist/index.html',html);
console.log('Built Box Chevy only + paid trunk audio:',Buffer.byteLength(html),'bytes');
