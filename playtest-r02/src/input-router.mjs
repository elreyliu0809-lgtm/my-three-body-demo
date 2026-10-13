const editTarget=n=>!!n&&(n.matches?.('input,textarea,select,[contenteditable]:not([contenteditable="false"])')||n.isContentEditable||!!n.closest?.('[contenteditable]:not([contenteditable="false"])'));
export function createInputRouter({scene,host,getProjection,canvas,onObject=()=>{},onCompose=()=>{},onEscape=()=>{},isPanelOpen=()=>false}){
 let composing=false,disposed=false,lastPermission='',movementKeys=new Set();const listeners=[];
 function listen(node,type,fn,options){node.addEventListener(type,fn,options);listeners.push(()=>node.removeEventListener(type,fn,options));}
 function permissions(){const p=getProjection(),dialog=!!document.querySelector('dialog[open]'),editable=editTarget(document.activeElement),blocked=disposed||document.hidden||composing||host.composing||dialog||editable||isPanelOpen(),inspection=p.inspection===true||scene.audit?.active===true;return {move:!blocked&&!inspection&&p.can_manual_move===true&&p.actor_safe===true&&!p.root_lease_held,camera:!blocked&&!inspection&&p.can_camera===true&&!p.camera_lease_held};}
 function sync(){const editable=editTarget(document.activeElement)||!!document.querySelector('dialog[open]')||isPanelOpen();host.text_focus=editable;host.composing=composing;const permission=permissions(),sig=JSON.stringify(permission);if(sig!==lastPermission){scene.clearControls();movementKeys.clear();lastPermission=sig;}scene.setInputPermission?.(permission);return permission;}
 function clear(){scene.clearControls();movementKeys.clear();}
 listen(document,'compositionstart',()=>{composing=true;host.composing=true;clear();sync()},true);
 listen(document,'compositionend',()=>{composing=false;host.composing=false;clear();sync()},true);
 listen(document,'focusin',()=>{clear();sync()},true);listen(document,'focusout',()=>{clear();queueMicrotask(sync)},true);
 listen(document,'keydown',e=>{
  const target=e.target,key=e.key.toLowerCase(),editor=editTarget(target),dialog=!!target.closest?.('dialog[open]');
  // Editors retain native typing and their own Ctrl+Enter handler; no scene path runs.
  if(editor||dialog)return;
  if(e.isComposing||composing||host.composing||e.keyCode===229){if(target===canvas){e.stopImmediatePropagation();clear();}return;}
  const p=getProjection(),inspect=p.inspection===true||scene.audit?.active===true;
  if(e.key==='Escape'&&isPanelOpen()){e.preventDefault();e.stopImmediatePropagation();onEscape();clear();return;}
  if(target!==canvas)return;
  if(e.ctrlKey||e.metaKey||e.altKey){e.stopImmediatePropagation();clear();return;}
  if(key==='e'||key==='f'){e.preventDefault();e.stopImmediatePropagation();clear();if(!inspect&&!document.hidden){if(key==='e'&&p.actor_safe===true&&!p.root_lease_held)onObject();else if(key==='f')onCompose();}return;}
  if(['w','a','s','d'].includes(key)){if(!sync().move){e.preventDefault();e.stopImmediatePropagation();clear();}else movementKeys.add(key);}
  if(e.key==='Escape'&&!sync().camera){e.preventDefault();e.stopImmediatePropagation();clear();}
 },true);
 listen(document,'keyup',e=>{if(movementKeys.has(e.key.toLowerCase())){movementKeys.delete(e.key.toLowerCase());if(e.target!==canvas)clear();}},true);
 for(const type of ['pointerdown','pointermove','wheel'])listen(document,type,e=>{if(e.target!==canvas)return;if(!sync().camera){if(type==='pointerdown'){clear();if(!document.querySelector('dialog[open]')&&!isPanelOpen())canvas.focus();}e.stopImmediatePropagation();if(e.cancelable)e.preventDefault();}}, {capture:true,passive:false});
 listen(window,'blur',clear);listen(document,'visibilitychange',clear);listen(window,'pagehide',clear);
 sync();return {update:sync,snapshot:()=>({composing,focus_owner:editTarget(document.activeElement)?'editor':document.querySelector('dialog[open]')?'dialog':document.activeElement===canvas?'scene':'panel',movement_keys:[...movementKeys],permission:permissions()}),dispose(){disposed=true;for(const remove of listeners)remove();clear();scene.setInputPermission?.({move:false,camera:false});}};
}
