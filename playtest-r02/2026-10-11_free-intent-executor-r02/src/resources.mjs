export function overlaps(a,b){
 if(a===b)return true;
 const x=a.split(':'),y=b.split(':');
 return x[0]==='actor'&&y[0]==='actor'&&x[1]===y[1]&&(['root','hands'].includes(x[2])&&['root','hands'].includes(y[2]));
}
export class Resources {
 constructor(){this.locks=new Map();}
 acquire(owner,claims){if([...this.locks].some(([key,v])=>v!==owner&&claims.some(c=>overlaps(c,key))))return false;for(const c of claims)this.locks.set(c,owner);return true;}
 release(owner){for(const [k,v]of this.locks)if(v===owner)this.locks.delete(k);}
 clear(){this.locks.clear();}
 snapshot(){return Object.fromEntries(this.locks);}
}
