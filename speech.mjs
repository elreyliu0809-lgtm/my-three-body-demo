export function speechDiagnostics(){return {secure_context:globalThis.isSecureContext===true,browser_api:!!(globalThis.SpeechRecognition||globalThis.webkitSpeechRecognition),microphone_permission:'NOT_REQUESTED',network_service:'NOT_TESTED; browser recognition may use external service',text_model_service:'LIVE_TEXT_API; actual connection reported by UI',audio_transmission_authorized:false,actual_transcript_observed:false};}
export class SpeechDraft{
 constructor(onText,onStatus,{authorized=false}={}){this.onText=onText;this.onStatus=onStatus;this.authorized=authorized;this.recognition=null;}
 start(){if(!this.authorized){this.onStatus('本包没有录音/音频外传授权。浏览器支持检查可用，但未启动麦克风或语音服务。');return false;}const API=globalThis.SpeechRecognition||globalThis.webkitSpeechRecognition;if(!API){this.onStatus('当前浏览器没有 SpeechRecognition 接口；没有转写。');return false;}
  const r=new API();this.recognition=r;r.lang='zh-CN';r.interimResults=true;r.continuous=false;r.onresult=e=>{let text='';for(const result of e.results)text+=result[0].transcript;this.onText(text);this.onStatus('浏览器转写已进入可编辑草稿；尚未发送。');};r.onerror=e=>this.onStatus('浏览器转写错误：'+e.error+'；未归因于文本模型。');r.onend=()=>{this.recognition=null;};try{r.start();return true;}catch(e){this.onStatus('无法启动：'+e.name);return false;}
 }
 stop(){this.recognition?.stop();}
}
