export function interpret(input){
 const text=Array.from(String(input).trim()).join('');
 if(!text||Array.from(text).length>600)return {kind:'none',reason:'INVALID_INPUT',explanation:'请输入1—600个字符。'};
 if(/[?？]|不要|不想|别|不跳|如果|假如|要是|能否|可以.*吗|能.*吗|怎么|如何|想知道|他说|她说|他说过|我在问|是否|不愿/.test(text))return {kind:'none',reason:'NOT_EXECUTABLE_INTENT',explanation:'这是否定、条件、询问或转述；没有执行动作。'};
 const normalized=text.replace(/[。！!\s]/g,'');
 if(['跳上桌子','跳上柜台','我要跳上桌子','我跳上桌子'].includes(normalized))return {kind:'jump_counter',mode:'local_fixture'};
 if(['提交申请','我要提交申请','申请加入治安军'].includes(normalized))return {kind:'submit_application',mode:'local_fixture'};
 if(['走下桌子','下桌子'].includes(normalized))return {kind:'unsupported',reason:'ENGINE_CAPABILITY_MISSING',explanation:'下桌动作尚未实现；身体和世界状态没有改变。'};
 if(/飞到月球|瞬移|穿墙|超能力/.test(normalized))return {kind:'unsupported',reason:'WORLD_INFEASIBLE',explanation:'当前普通人的世界规则不允许该行动；没有执行。'};
 return {kind:'unsupported',reason:'ENGINE_CAPABILITY_MISSING',explanation:'本地夹具尚未实现这项能力，也没有连接AI理解自由语义；没有执行。'};
}
