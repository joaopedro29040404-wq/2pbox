#!/usr/bin/env node
import http from 'node:http';
import crypto from 'node:crypto';
const PORT=Number(process.env.AGENCY_PORT||4317);
const OLLAMA=(process.env.OLLAMA_URL||'http://127.0.0.1:11434').replace(/\/$/,'');
const MODEL=process.env.OLLAMA_MODEL||'llama3.2';
const COMFY=(process.env.COMFYUI_URL||'http://127.0.0.1:8188').replace(/\/$/,'');
const CHECKPOINT=process.env.COMFYUI_CHECKPOINT||'';
const headers={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Methods':'GET,POST,OPTIONS','Access-Control-Allow-Headers':'Content-Type'};
async function json(url,opt={}){const r=await fetch(url,opt);const t=await r.text();let d;try{d=JSON.parse(t)}catch{d={}}if(!r.ok)throw new Error(d.error||d.message||'Serviço local indisponível');return d}
async function text(prompt){const d=await json(OLLAMA+'/api/generate',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({model:MODEL,prompt,stream:false,options:{temperature:.72}})});return d.response||''}
async function image(prompt){
 if(!CHECKPOINT)throw new Error('Configure COMFYUI_CHECKPOINT com um modelo avançado instalado no ComfyUI.');
 const workflow={
  '3':{class_type:'CheckpointLoaderSimple',inputs:{ckpt_name:CHECKPOINT}},
  '4':{class_type:'CLIPTextEncode',inputs:{text:prompt,clip:['3',1]}},
  '5':{class_type:'CLIPTextEncode',inputs:{text:'low quality, blurry, distorted, watermark, malformed typography, misspelled words',clip:['3',1]}},
  '6':{class_type:'EmptyLatentImage',inputs:{width:1080,height:1920,batch_size:1}},
  '7':{class_type:'KSampler',inputs:{seed:Math.floor(Math.random()*1e15),steps:35,cfg:7.5,sampler_name:'euler',scheduler:'normal',denoise:1,model:['3',0],positive:['4',0],negative:['5',0],latent_image:['6',0]}},
  '8':{class_type:'VAEDecode',inputs:{samples:['7',0],vae:['3',2]}},
  '9':{class_type:'SaveImage',inputs:{filename_prefix:'2PBox_Agency',images:['8',0]}}
 };
 const q=await json(COMFY+'/prompt',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({prompt:workflow,client_id:crypto.randomUUID()})});
 for(let i=0;i<240;i++){await new Promise(r=>setTimeout(r,1500));const h=await json(COMFY+'/history/'+q.prompt_id);const o=h[q.prompt_id]?.outputs?.['9']?.images?.[0];if(o){const u=COMFY+'/view?filename='+encodeURIComponent(o.filename)+'&subfolder='+encodeURIComponent(o.subfolder||'')+'&type='+encodeURIComponent(o.type||'output');const b=Buffer.from(await(await fetch(u)).arrayBuffer());return 'data:image/png;base64,'+b.toString('base64')}}
 throw new Error('A geração avançada excedeu o tempo limite local.');
}
async function generate(b){
 const p=b.product;
 const raw=await text('Você é uma agência de publicidade. Crie briefing para um '+b.type+' da 2P Box. Produto: '+p.name+'. Preço: R$ '+p.price+'. Objetivo: '+b.objective+'. Use uma estratégia de comunicação e não invente fatos. Retorne JSON com title, strategy e visual_prompt.');
 let x;try{x=JSON.parse(raw.replace(/^```json|^```$/g,'').trim())}catch{x={title:p.name,strategy:'Benefício + curiosidade',visual_prompt:'Premium commercial social media advertising for '+p.name+', 2P Box yellow black off-white palette, clean modern Brazilian ecommerce, strong visual hierarchy, product-focused, generous negative space, sophisticated art direction, Instagram vertical, no watermark.'}}
 return {title:x.title||p.name,strategy:x.strategy||'Estratégia de comunicação',image:await image(x.visual_prompt)};
}
http.createServer(async(req,res)=>{
 Object.entries(headers).forEach(([k,v])=>res.setHeader(k,v));
 if(req.method==='OPTIONS'){res.writeHead(204);return res.end()}
 try{
  if(req.url==='/health'){res.writeHead(200,{'Content-Type':'application/json'});return res.end(JSON.stringify({ok:true,local:true,quality:'advanced'}))}
  if(req.method==='POST'&&req.url==='/generate'){let raw='';for await(const c of req)raw+=c;const r=await generate(JSON.parse(raw));res.writeHead(200,{'Content-Type':'application/json'});return res.end(JSON.stringify(r))}
  res.writeHead(404);res.end()
 }catch(e){res.writeHead(500,{'Content-Type':'application/json'});res.end(JSON.stringify({error:e instanceof Error?e.message:'Erro local'}))}
}).listen(PORT,'127.0.0.1',()=>console.log('2P Box Local Agency: http://127.0.0.1:'+PORT));
