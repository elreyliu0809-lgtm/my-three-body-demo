import {view} from './scene.js';
import {validatePlan} from './plan.mjs';
import {initialState,commitEvent,restoreState} from './rules.mjs';
import {speechDiagnostics} from './speech.mjs';
const $=id=>document.getElementById(id),draft=$('draft'),editor=$('editor'),inspection=$('inspection'),help=$('speechPanel'),key='mt-mobile-live-r04';
const fixtures=await(await fetch('./fixtures.json')).json();
let state=initialState(),composing=false,previousFocus=null,activeRequest=null,pendingIntent=null,connected=false,busy=false,remaining=null,liveCalls=0,planCancelled=false;
function message(text,speaker='探索大厅'){$('message').textContent=text;$('speaker').textContent=speaker;}
function save(){try{localStorage.setItem(key,JSON.stringify({draft:draft.value,state}));}catch{message('本地存储不可用，草稿仍保留在当前页面。');}}
try{const saved=JSON.parse(localStorage.getItem(key)||'null');if(saved){draft.value=String(saved.draft||'');state=restoreState(saved.state);}}catch{message('存档无法恢复，尚未执行任何行动。');}
function updateDraft(){const length=Array.from(draft.value).length;$('count').textContent=length+' / 500';$('send').disabled=composing||length===0||length>500||!connected||busy;$('editorError').textContent=length>500?'超过500个字符；请缩短后再发送，草稿不会截断。':'';save();}
function openPanel(panel,owner){if(!view.debug().done||document.querySelector('dialog[open]'))return false;previousFocus=document.activeElement;view.setOwner(owner);panel.showModal();$('stage').classList.add('panel-open');$('keys').hidden=true;return true;}
function openEditor(){if(openPanel(editor,'COMPOSE')){draft.focus();updateDraft();}}
function reaction(kind){const lines=fixtures.reactions?.[kind];if(!lines)return;$('officerLine').textContent='征募官：'+lines.officer;$('companionLine').textContent='同行者：'+lines.companion;$('reactions').hidden=false;}
function openInspection(){if(!view.debug().near_counter)return;if(openPanel(inspection,'INSPECT')){view.inspect();$('notice').textContent=fixtures.notice;$('applicationState').textContent='尚未提交申请。';reaction('inspect');}}
function openHelp(){if(openPanel(help,'COMPOSE'))$('speechStatus').textContent=JSON.stringify(speechDiagnostics(),null,2);}
for(const panel of [editor,inspection,help])panel.addEventListener('close',()=>{save();$('stage').classList.remove('panel-open');$('keys').hidden=false;view.return();previousFocus?.focus();});
for(const button of document.querySelectorAll('[data-close]'))button.addEventListener('click',()=>$(button.dataset.close).close());
for(const panel of [editor,inspection,help])panel.addEventListener('keydown',e=>{if(e.key!=='Tab')return;const nodes=[...panel.querySelectorAll('button:not([disabled]),textarea,input,summary')].filter(n=>n.getClientRects().length);if(e.shiftKey&&document.activeElement===nodes[0]){e.preventDefault();nodes.at(-1).focus();}else if(!e.shiftKey&&document.activeElement===nodes.at(-1)){e.preventDefault();nodes[0].focus();}});
$('compose').addEventListener('click',openEditor);$('inspect').addEventListener('click',openInspection);$('help').addEventListener('click',openHelp);
$('ask').addEventListener('click',()=>{if(!view.debug().near_counter)return;message('申请需筛选；本人留驻承诺尚未生效，同行者需要独立申请。','征募官 · 本地预写回应');$('reactions').hidden=true;});
$('routeRecruit').addEventListener('click',()=>message('征募窗口在前方。靠近后可以阅读条件；申请尚未提交。'));
$('routeTransfer').addEventListener('click',()=>message('右侧是转运检查队列，和征募申请分开。此片段尚未接入转运办理。'));
document.addEventListener('request-compose',openEditor);document.addEventListener('request-inspect',openInspection);
draft.addEventListener('input',updateDraft);draft.addEventListener('compositionstart',()=>{composing=true;updateDraft();});draft.addEventListener('compositionend',()=>{composing=false;updateDraft();});$('fixture').addEventListener('change',updateDraft);
draft.addEventListener('keydown',e=>{if(e.key==='Enter'&&e.ctrlKey&&!e.isComposing&&!composing){e.preventDefault();$('send').click();}});
for(const button of document.querySelectorAll('[data-draft]'))button.addEventListener('click',()=>{draft.value=button.dataset.draft;draft.focus();updateDraft();});
const config=await(await fetch('./trial-config.json')).json();
const authHeaders=()=>({'content-type':'application/json',Authorization:'Bearer '+$('invite').value.trim()});
try{$('invite').value=sessionStorage.getItem('mt-r04-invite')||'';}catch{}
async function connect(){try{const r=await fetch(config.apiBase+'/api/health',{headers:authHeaders(),signal:AbortSignal.timeout(15000)}),v=await r.json();if(!r.ok)throw Error(v.error);if(v.task_id!=='MT-MOBILE-LIVE-R04-20261010'||!v.ready)throw Error('本轮服务未就绪');connected=true;remaining=v.remaining;if(v.last_request_id){try{if(!sessionStorage.getItem('mt-r04-last-request'))sessionStorage.setItem('mt-r04-last-request',v.last_request_id);}catch{}}$('connectionStatus').textContent='已连接 '+v.model+' · 剩余 '+remaining+' / 20 次';$('assetStatus').textContent='真实模型 · 剩余 '+remaining+' / 20';try{sessionStorage.setItem('mt-r04-invite',$('invite').value.trim());}catch{}updateDraft();}catch(e){connected=false;$('connectionStatus').textContent='连接失败：'+e.message;updateDraft();}}
$('connect').addEventListener('click',connect);
const actorNames={player:'你',officer:'征募官',companion:'同行者'};
const outcomes=[];
function waitUntil(predicate){return new Promise((resolve,reject)=>{const started=performance.now(),t=setInterval(()=>{if(predicate()){clearInterval(t);resolve();}else if(view.debug().owner==='SUSPENDED'||performance.now()-started>45000){clearInterval(t);reject(Error('执行暂停或超时'));}},50);});}
async function recoverLast(){let id;try{id=sessionStorage.getItem('mt-r04-last-request');}catch{}if(!id){message('本浏览器还没有可取回的回应。');return;}if(editor.open)editor.close();busy=true;updateDraft();try{let v;for(let i=0;i<120;i++){const r=await fetch(config.apiBase+'/api/result?id='+encodeURIComponent(id),{headers:authHeaders(),signal:AbortSignal.timeout(15000)});v=await r.json();if(!r.ok)throw Error(v.error);if(!v.pending)break;await new Promise(r=>setTimeout(r,1000));}if(v.pending)throw Error('仍在回应，请稍后取回');remaining=v.remaining;$('assetStatus').textContent='真实模型 · 剩余 '+remaining+' / 20';if(v.error)throw Error(v.error);pendingIntent=v;}catch(e){message('没有执行：'+e.message);busy=false;updateDraft();}}
$('recover').addEventListener('click',recoverLast);
async function executeIntent(result){
 if(result.source_world_version!==state.world_version){message('现场已改变，请依据现在的位置重新表达意图。');busy=false;updateDraft();return;}
 view.setWorldVersion(state.world_version);const plan=validatePlan(result.plan);outcomes.length=0;planCancelled=false;
 if(plan.decision!=='allowed'){message((plan.decision==='world_forbidden'?'世界规则限制：':'现有能力不足：')+plan.explanation);busy=false;updateDraft();return;}
 $('actionBar').hidden=false;message(plan.explanation,'现场判断');
 try{for(const step of plan.steps){if(planCancelled||view.debug().owner==='SUSPENDED')throw Error('EXECUTION_CANCELLED');view.setOwner('EXPLORE');$('phase').textContent='执行计划 · '+step.op;let outcome={ok:true};
  if(step.op==='play_clip')outcome=await view.playClip(step,{request_id:result.request_id,world_version:state.world_version});
  if(step.op==='move_to')outcome=await view.moveTo(step.x,step.z);
  if(step.op==='face')outcome=view.face(step.actor,step.target);
  if(step.op==='say'){view.setOwner('DIRECTOR');message(step.text,actorNames[step.actor]+' · 模型台词');await new Promise(r=>setTimeout(r,Math.min(3000,1200+step.text.length*30)));}
  if(step.op==='wait'){view.setOwner('DIRECTOR');await new Promise(r=>setTimeout(r,step.seconds*1000));}
  if(step.op==='read_notice'){if(!view.debug().near_counter)outcome={ok:false,reason:'WORLD_TARGET_OUT_OF_REACH'};else{message(fixtures.notice,'征募条件');await new Promise(r=>setTimeout(r,2000));}}
  if(step.op==='jump_counter'){activeRequest={request_id:result.request_id};outcome=view.start({kind:'jump_counter'});if(outcome.ok){await waitUntil(()=>view.debug().done);outcome=view.debug().success?{ok:true}:{ok:false,reason:'PHYSICAL_ACTION_NOT_COMPLETED'};}}
  if(step.op==='leave_counter'){outcome=view.leaveTable();if(outcome.ok)await waitUntil(()=>view.debug().done);}
  outcomes.push({op:step.op,...outcome});if(!outcome.ok)throw Error(outcome.reason||'EXECUTION_FAILED');
 }}catch(e){const reason=e.message.startsWith('BODY_SWEEP_BLOCKED:')?'身体动作受到现场障碍阻挡，已安全恢复':({EXECUTION_CANCELLED:'行动已取消',POSTURE_PRECONDITION:'需要先起身站稳',SUPPORTED_FLOOR_REQUIRED:'该动作需要地面支撑',EXECUTION_INTERRUPTED:'行动被中断',BODY_OUT_OF_WORLD:'动作将超出大厅边界'}[e.message]||e.message);message('计划未完成：'+reason+'。后续步骤没有执行。','执行结果');}
 finally{if(view.debug().owner!=='SUSPENDED'&&view.debug().done)view.setOwner('EXPLORE');$('actionBar').hidden=true;busy=false;updateDraft();save();if(result.source==='AUTHOR_FIXTURE'&&$('authorResult'))$('authorResult').textContent=JSON.stringify({outcomes,scene:view.debug(),state});}
}
$('send').addEventListener('click',async()=>{if($('send').disabled||composing)return;busy=true;updateDraft();const snapshot={position:view.debug().position,world_version:state.world_version,owner:'EXPLORE',posture:view.debug().posture,capability_revision:'R05',application:state.application,screening:state.screening,admission:state.admission,near_counter:view.debug().near_counter,events:state.events.slice(-5)};const request={request_id:crypto.randomUUID(),input:draft.value.trim(),snapshot};try{sessionStorage.setItem('mt-r04-last-request',request.request_id);}catch{}save();editor.close();$('reactions').hidden=true;message('模型正在结合现场生成计划……','现场判断');try{const r=await fetch(config.apiBase+'/api/turn',{method:'POST',headers:authHeaders(),body:JSON.stringify(request),signal:AbortSignal.timeout(75000)}),v=await r.json();remaining=v.remaining;$('assetStatus').textContent='真实模型 · 剩余 '+remaining+' / 20';if(!r.ok||v.error)throw Error(v.error);liveCalls++;if(v.pending){await recoverLast();}else pendingIntent=v;}catch(e){message('没有执行：'+e.message+'。没有自动重发调用。');busy=false;updateDraft();}});
document.addEventListener('scene-context',e=>{const available=e.detail.owner==='EXPLORE';$('prompt').hidden=!e.detail.nearCounter||!available;$('inspect').disabled=!available||!e.detail.nearCounter;$('ask').disabled=!available||!e.detail.nearCounter;$('compose').disabled=!available||busy;$('leaveTable').hidden=e.detail.position.y<.2;$('leaveTable').disabled=!available;$('footState').textContent=e.detail.owner==='SUSPENDED'?'已暂停':e.detail.position.y>.2?'柜台上 · 可继续移动或走下':'探索大厅';if(pendingIntent&&available){const intent=pendingIntent;pendingIntent=null;executeIntent(intent);}});
$('cancel').addEventListener('click',()=>{planCancelled=true;const result=view.cancel();message((result==='SAFE_LANDING_PENDING'||result==='SUPPORTED_RECOVERY_PENDING')?'已请求取消，先恢复到实际支撑的姿态。':'行动已取消，没有记录成功。');if(result==='CANCELLED')$('actionBar').hidden=true;});
$('leaveTable').addEventListener('click',()=>{const result=view.leaveTable();message(result.ok?'正在走到台面边缘，再回到地面。':'暂时无法离开：'+result.reason,'你的行动');});
document.addEventListener('action-progress',e=>{$('phase').textContent='行动中 · '+e.detail.phase;});
document.addEventListener('action-finished',e=>{const value=e.detail;$('actionBar').hidden=true;for(const event of value.events)state=commitEvent(state,{...event,request_id:activeRequest?.request_id,source_world_version:state.world_version});save();message(value.success?'已经落桌并站稳。可以继续移动或走下柜台。':value.cancelled?'行动已取消，身体已安全停稳。':'行动失败，尚未记录成功。','你的行动');activeRequest=null;$('scene').focus();});
document.addEventListener('body-floor-settled',e=>{state=commitEvent(state,{type:'body_settled',...e.detail,request_id:crypto.randomUUID(),source_world_version:state.world_version});save();$('reactions').hidden=true;message('已回到地面。可以继续探索。','你的行动');});
document.addEventListener('scene-suspended',()=>{if(!$('resumePanel').open)$('resumePanel').showModal();});$('resume').addEventListener('click',()=>{if(!view.debug().done)return;$('resumePanel').close();view.resume();});
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!view.debug().done){$('cancel').click();e.preventDefault();}});
$('assetStatus').textContent='真实模型待连接 · 输入试玩口令';
window.EngineeringApp={debug:()=>({state:structuredClone(state),speech:speechDiagnostics(),draft_length:Array.from(draft.value).length,fixture_enabled:$('fixture').checked,live_model_calls:liveCalls,remaining,connected,busy,plan_outcomes:structuredClone(outcomes),pending_intent:!!pendingIntent,scene:view.debug()})};
updateDraft();window.__ready=true;setInterval(()=>{$('engineeringEvidence').textContent=JSON.stringify(window.EngineeringApp.debug());},500);

for(const b of document.querySelectorAll('[data-move]')){let pressedAt=0,releaseTimer;const release=()=>{clearTimeout(releaseTimer);releaseTimer=setTimeout(()=>view.touchMove(b.dataset.move,false),Math.max(0,140-(performance.now()-pressedAt)));};b.addEventListener('pointerdown',e=>{e.preventDefault();pressedAt=performance.now();clearTimeout(releaseTimer);b.setPointerCapture(e.pointerId);view.touchMove(b.dataset.move,true);});b.addEventListener('pointerup',release);b.addEventListener('pointercancel',release);b.addEventListener('lostpointercapture',release);}if($('invite').value)connect();

// Author-only offline execution checks; excluded by hostname on the public site.
if(location.hostname==='127.0.0.1'&&new URLSearchParams(location.search).get('author')==='1'){
 const panel=document.createElement('aside');panel.id='authorChecks';panel.style='position:absolute;top:8px;left:8px;z-index:50;background:#122029;padding:8px;max-width:760px';panel.textContent='作者离线执行检查 · 0模型调用';const output=document.createElement('pre');output.id='authorResult';output.hidden=true;panel.append(output);
 for(const clip of view.inputs.contracts.action_library.clips){const b=document.createElement('button');b.textContent=clip.name;b.style='margin:2px;padding:5px';b.addEventListener('click',()=>{if(!busy&&view.debug().done){busy=true;executeIntent({source:'AUTHOR_FIXTURE',request_id:crypto.randomUUID(),source_world_version:state.world_version,plan:{schema:'scene-plan-v1',decision:'allowed',explanation:'作者离线clip执行检查，不代表模型理解。',steps:[{op:'play_clip',actor:'player',clip:clip.name,params:{rate:1,cycles:1}}]}});}});panel.append(b);}
 for(const [label,steps]of [['AUTHOR jump_counter',[{op:'jump_counter'}]],['AUTHOR approach',[{op:'move_to',actor:'player',x:0,z:.76}]],['AUTHOR cancellable dance',[{op:'play_clip',actor:'player',clip:'dance_loop',params:{rate:1,cycles:4}}]]]){const b=document.createElement('button');b.textContent=label;b.addEventListener('click',()=>{if(!busy&&view.debug().done){busy=true;output.textContent='';executeIntent({source:'AUTHOR_FIXTURE',request_id:crypto.randomUUID(),source_world_version:state.world_version,plan:{schema:'scene-plan-v1',decision:'allowed',explanation:'作者离线检查',steps}});}});panel.append(b);}$('stage').append(panel);
}
