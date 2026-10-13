export const ACTORS=['player','lin','officer'];
export const clone=value=>structuredClone(value);
export async function sha256(text){return [...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(text)))].map(n=>n.toString(16).padStart(2,'0')).join('');}
export class ActorRuntime {
 constructor({scene_id,baseline}){this.scene_id=scene_id;this.baseline=clone(baseline);this.states=new Map(ACTORS.map(id=>[id,{id,bound:true,actor_version:1,persona_version:1,observations:[],memories:[],baseline_receipt:{source:baseline.source,source_hash:baseline.source_hash,adoption_id:baseline.adoption_id,scene_id,actor_id:id},private_facts:id==='lin'?['APPLIED_ONCE_NOT_ADMITTED']:[]} ]));this.request_revision=0;this.draft_revision=0;this.draft='';this.parent=null;this.cancelled=new Set();}
 exists(id){return !!this.states.get(id)?.bound;}
 state(id){const s=this.states.get(id);if(!s||!s.bound)throw Error('ACTOR_NOT_BOUND');return clone(s);}
 versions(){return Object.fromEntries([...this.states].map(([id,s])=>[id,{actor_version:s.actor_version,persona_version:s.persona_version,bound:s.bound}]));}
 edit(text){this.draft=text;this.draft_revision++;return this.draft_revision;}
 adopt(request){if(this.parent)this.invalidate('NEW_REQUEST');this.request_revision=request.request_revision;this.parent={...clone(request),scene_id:this.scene_id,cancelled:false,versions:this.versions(),wire:clone(request)};return clone(this.parent);}
 submit({text,world_version,scene_binding_id,scene_fingerprint,capability_snapshot_id,policy_snapshot_id,knowledge_snapshot_id,session_id,candidate_id}){if(this.parent)this.invalidate('NEW_REQUEST');this.request_revision++;this.parent={request_id:'story-request-'+crypto.randomUUID(),request_revision:this.request_revision,actor_id:'player',raw_text:text,scene_id:this.scene_id,source_world_version:world_version,scene_binding_id,scene_fingerprint,capability_snapshot_id,policy_snapshot_id,knowledge_snapshot_id,session_id,candidate_id,cancelled:false,versions:this.versions()};return clone(this.parent);}
 invalidate(reason){if(this.parent){this.parent.cancelled=true;this.cancelled.add(this.parent.request_id);}this.onInvalidate?.(reason);}
 leave(){this.invalidate('LEAVE_SCENE');this.scene_id='LEFT';}
 unbind(id){this.invalidate('UNBIND');this.states.get(id).bound=false;this.states.get(id).actor_version++;}
 revisePersona(id){this.invalidate('PERSONA_CHANGED');this.states.get(id).persona_version++;}
 observe(receipt){for(const id of receipt.recipient_ids){if(!this.exists(id))throw Error('RECEIVER_NOT_BOUND');const s=this.states.get(id);if(!s.observations.some(o=>o.id===receipt.id)){s.observations.push(clone(receipt));s.memories.push({kind:'HEARD_CLAIM',receipt_id:receipt.id,speaker:receipt.speaker_id,text:receipt.text,verified_external_fact:false});}}}
 context(id){return this.state(id);}
 snapshot(){return {scene_id:this.scene_id,baseline:clone(this.baseline),states:Object.fromEntries([...this.states].map(([id,s])=>[id,clone(s)])),request_revision:this.request_revision,draft_revision:this.draft_revision,draft:this.draft,parent:clone(this.parent)};}
}
