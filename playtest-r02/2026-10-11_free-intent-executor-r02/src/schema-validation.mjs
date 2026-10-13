// Deliberately supports exactly the keywords present in the frozen R01 schemas.
// An unknown assertion keyword fails closed instead of silently accepting it.
const annotations=new Set(['$schema','$id','description','title']);
const assertions=new Set(['type','const','enum','anyOf','properties','required','additionalProperties','items','minLength','maxLength','minItems','maxItems','minimum','maximum','exclusiveMinimum','pattern','maxProperties','format']);
export function validateSchema(value,schema,path='$') {
 const errors=[];
 for(const key of Object.keys(schema))if(!annotations.has(key)&&!assertions.has(key))errors.push(path+': unsupported schema keyword '+key);
 if(schema.anyOf&&!schema.anyOf.some(s=>validateSchema(value,s,path).length===0))errors.push(path+': anyOf');
 if('const' in schema&&JSON.stringify(value)!==JSON.stringify(schema.const))errors.push(path+': const');
 if(schema.enum&&!schema.enum.some(v=>JSON.stringify(v)===JSON.stringify(value)))errors.push(path+': enum');
 const types=Array.isArray(schema.type)?schema.type:[schema.type];
 const matches=t=>t===undefined||t==='null'&&value===null||t==='array'&&Array.isArray(value)||t==='object'&&value!==null&&typeof value==='object'&&!Array.isArray(value)||t==='integer'&&Number.isSafeInteger(value)||t==='number'&&typeof value==='number'&&Number.isFinite(value)||t==='string'&&typeof value==='string'||t==='boolean'&&typeof value==='boolean';
 if(!types.some(matches))return [...errors,path+': type'];
 if(typeof value==='string'){
  const n=[...value].length;
  if(n<(schema.minLength??0)||n>(schema.maxLength??Infinity))errors.push(path+': length');
  if(schema.pattern&&!new RegExp(schema.pattern,'u').test(value))errors.push(path+': pattern');
  if(schema.format==='date-time'&&(!/^\d{4}-\d\d-\d\dT/.test(value)||!Number.isFinite(Date.parse(value))))errors.push(path+': date-time');
 }
 if(typeof value==='number'&&(!Number.isFinite(value)||value<(schema.minimum??-Infinity)||value>(schema.maximum??Infinity)||schema.exclusiveMinimum!==undefined&&value<=schema.exclusiveMinimum))errors.push(path+': numeric range');
 if(Array.isArray(value)){
  if(value.length<(schema.minItems??0)||value.length>(schema.maxItems??Infinity))errors.push(path+': item count');
  if(schema.items)value.forEach((v,i)=>errors.push(...validateSchema(v,schema.items,path+'['+i+']')));
 }
 if(value&&typeof value==='object'&&!Array.isArray(value)){
  const keys=Object.keys(value);if(keys.length>(schema.maxProperties??Infinity))errors.push(path+': property count');
  for(const key of schema.required??[])if(!Object.hasOwn(value,key))errors.push(path+'.'+key+': required');
  for(const key of keys){if(['__proto__','constructor','prototype'].includes(key))errors.push(path+': forbidden key');else if(schema.properties?.[key])errors.push(...validateSchema(value[key],schema.properties[key],path+'.'+key));else if(schema.additionalProperties===false)errors.push(path+'.'+key+': unknown property');}
 }
 return errors;
}
