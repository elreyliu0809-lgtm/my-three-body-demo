export const ACTORS=Object.freeze(['player','officer','companion']);
export const TARGETS=Object.freeze(['player','officer','companion','application','side_door','queue','counter']);
const verbs=Object.freeze(['look_at','nod','take_paper','push_paper','hold_paper','talk']);
export function validatePerformance(value,action){
  if(!Array.isArray(value)||value.length<2||value.length>8)throw Error('演出指令须包含2至8个动作。');
  const beats=value.map(b=>{
    if(!b||!ACTORS.includes(b.actor)||!verbs.includes(b.verb)||!TARGETS.includes(b.target))throw Error('未知角色、动作或目标。');
    if(!Number.isFinite(b.at)||b.at<0||b.at>12||!Number.isFinite(b.seconds)||b.seconds<.4||b.seconds>7||b.at+b.seconds>18)throw Error('演出时间越界。');
    if(b.verb==='take_paper'&&(b.actor!=='player'||b.target!=='application'||!['deceive','read_order','ask_terms','join_security'].includes(action)))throw Error('此时不能让该角色拿申请。');
    if(b.verb==='push_paper'&&(b.actor!=='officer'||b.target!=='application'))throw Error('只有柜台内征募官可推申请。');
    if(b.verb==='hold_paper'&&b.actor!=='player')throw Error('只有玩家可持申请。');
    if(b.verb==='talk'&&b.actor==='player')throw Error('不生成或改写玩家的台词。');
    return {actor:b.actor,verb:b.verb,target:b.target,at:b.at,seconds:b.seconds};
  });
  const channel=b=>b.verb==='look_at'?'gaze':b.verb==='talk'?'speech':'gesture';
  for(let i=0;i<beats.length;i++)for(let j=i+1;j<beats.length;j++){
    const a=beats[i],b=beats[j],overlap=a.at<b.at+b.seconds&&b.at<a.at+a.seconds;
    if(overlap&&a.actor===b.actor&&channel(a)===channel(b))throw Error('同一角色的同类动作占用冲突。');
    if(overlap&&a.verb==='talk'&&b.verb==='talk')throw Error('对话字幕需要先后说话。');
  }
  if(new Set(beats.map(b=>b.actor)).size<2)throw Error('多人演出须至少涉及两个角色。');
  return beats.sort((a,b)=>a.at-b.at);
}
export function choreographyPrompt(){return `
额外输出performance数组，与上面的action/npc/companion/narration/understanding/reason放在同一个JSON对象内。它是本轮多个角色实际配合的演出提案，包含3至6个短动作，不是写程序。每项严格为{"actor":"player|officer|companion","verb":"look_at|nod|take_paper|push_paper|hold_paper|talk","target":"player|officer|companion|application|side_door|queue|counter","at":0,"seconds":1.5}。
至少两个角色；不同角色可同时动作。同一角色的同类动作不重叠，look_at可与talk同时。officer和companion依次talk，不能同时talk，不生成玩家台词。只有player可take_paper/hold_paper，只有officer可push_paper；拿纸不是签字，不能因为拿纸就加入。拿纸只适用于deceive/read_order/ask_terms/join_security。请使用现有物件、位置和角色，不创造新人物或道具。
at为开场后秒数0至12，seconds为.4至7，总长不超过18秒，尽量5至9秒。行动需体现自由输入中的协作意图；例如玩家假意报名吸引征募官、同行者观察侧门，可以玩家take_paper、征募官look_at player、同行者look_at side_door并行，然后两位NPC先后talk。位置移动由固定规则确定，不在performance里安排瞬移、任意坐标或walk。沿用事实：同行者免迁未获保证，反抗者弱势隐蔽。`;}
