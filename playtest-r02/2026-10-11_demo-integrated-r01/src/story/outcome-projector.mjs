export class OutcomeProjector {
 constructor(){this.facts=new Set();this.axes={LIN:'OPEN',OFFICER:'OPEN'};this.seen=new Set();}
 ingest(r,{playerKnows}){if(this.seen.has(r.id))return;this.seen.add(r.id);if(!r.complete||!r.source_event_id)return;const to=id=>r.recipient_ids.includes(id);
 if(r.semantic==='E01'&&r.speaker_id==='player'&&to('lin')&&r.privacy_verified)this.facts.add('E01');
 if(r.semantic==='E02'&&r.speaker_id==='lin'&&to('player')&&this.facts.has('E01'))this.facts.add('E02');
 if(r.semantic==='E03'&&r.speaker_id==='player'&&to('lin')&&!r.privacy_verified&&playerKnows('E02'))this.facts.add('E03');
 if(r.semantic==='E04'&&r.speaker_id==='lin'&&to('player')&&this.facts.has('E03'))this.facts.add('E04');
 if(r.semantic==='E08'&&r.speaker_id==='officer'&&to('player'))this.facts.add('E08');
 if(this.facts.has('E01')&&this.facts.has('E02'))this.axes.LIN='L1';if(this.facts.has('E03')&&this.facts.has('E04')&&this.axes.LIN==='L1')this.axes.LIN='L2';if(this.facts.has('E08'))this.axes.OFFICER='O2';}
 snapshot(){return {facts:[...this.facts],axes:{...this.axes},application_state:'LIN_APPLIED_ONCE_NOT_ADMITTED',admission:false,application_receipt:false};}
}
