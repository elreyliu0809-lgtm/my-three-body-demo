export class CapabilityRegistry {
 constructor(contract){this.id='CM-C02-CAP-R02';this.entries=new Map(contract.registry.primitives.map(p=>[p.id,{...structuredClone(p),enabled:false,actors:[],proof:null,missing:'Adapter/asset verification required'}]));}
 enable(id,actors,proof){const p=this.entries.get(id);if(!p||!actors.length||!proof?.adapter||!proof?.asset_verified)throw Error('CAPABILITY_PROOF_REQUIRED');p.enabled=true;p.actors=[...actors];p.proof=structuredClone(proof);p.missing=null;}
 get(id){return this.entries.get(id);}
 claims(step){return this.get(step.primitive_id)?.resources.map(x=>x.replace('actor:self:','actor:'+step.actor_id+':'))??[];}
 snapshot(){return {id:this.id,primitives:[...this.entries.values()].map(p=>({id:p.id,enabled:p.enabled,actors:p.actors,proof:p.proof,missing:p.missing,resources:p.resources}))};}
}
