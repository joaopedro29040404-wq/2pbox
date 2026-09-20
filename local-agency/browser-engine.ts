export type LocalCreativeInput={type:'story'|'reel';product:{name:string;price:number|string;stock?:number|null;image_url?:string|null};objective:string;onProgress?:(message:string)=>void};
export type CreativePlan={angle:string;hook:string;headline:string;support:string;cta:string;strategy:string;direction:string};
export type LocalCreative={title:string;strategy:string;image:string;plan:CreativePlan};
const CACHE_KEY='2pbox-local-engine-v2';
const KNOWLEDGE=[
'Priorizar conteúdo original e transformação criativa; evitar aparência de repost ou conteúdo reciclado.',
'Construir narrativa com atenção inicial, contexto/benefício e ação clara.',
'Usar storytelling, problema/solução e conexão entre características e benefícios sem inventar especificações.',
'Criar diversidade de criativos e variações de ângulo para diferentes objetivos e públicos.',
'Manter formato vertical 9:16 para Stories/Reels e hierarquia visual forte.',
'CTA deve ser simples, específico e coerente com a etapa do funil.',
'A marca deve aparecer de forma consistente, sem depender de marca d’água de terceiros.',
'2P Box: amarelo #FFC400, preto #111111, branco/off-white #F7F7F3, formas arredondadas, tipografia pesada, elementos gráficos amarelos e linguagem comercial brasileira.'
].join(' ');
function clean(v:string){return String(v||'').replace(/\s+/g,' ').trim()}
function money(v:number|string){const n=Number(v);return Number.isFinite(n)?'R$ '+n.toFixed(2).replace('.',','):'Consultar'}
function escapeText(v:string){return clean(v).replace(/[<>&'"]/g,(c)=>({'<':'&lt;','>':'&gt;','&':'&amp;',"'":'&apos;','"':'&quot;'} as Record<string,string>)[c]||c)}
function angle(objective:string,type:'story'|'reel'){
const o=clean(objective).toLowerCase();
if(o.includes('clique')||o.includes('site'))return{angle:'Descoberta → clique',hook:'VOCÊ JÁ VIU ISSO?',headline:'TEM NA 2P BOX.',support:'Descubra o produto e veja todos os detalhes no nosso site.',cta:'VER PRODUTOS'};
if(o.includes('venda')||o.includes('convers'))return{angle:'Problema → solução → ação',hook:'PRECISANDO DE UMA BOA ESCOLHA?',headline:'ESCOLHA SEM COMPLICAÇÃO.',support:'Veja o produto, compare suas opções e escolha o que faz sentido para você.',cta:'VER PRODUTOS'};
if(o.includes('marca')||o.includes('alcance'))return{angle:'Marca → memória → produto',hook:'QUALIDADE. VARIEDADE. CONFIANÇA.',headline:'TEM A NOSSA CARA.',support:'Uma experiência de compra simples, visual e feita para o dia a dia.',cta:'CONHEÇA A 2P BOX'};
if(o.includes('urg')||o.includes('agora'))return{angle:'Atenção → oportunidade → ação',hook:'NÃO DEIXE PARA DEPOIS.',headline:'SE VOCÊ GOSTOU, OLHE DE PERTO.',support:'O produto está disponível no nosso catálogo online.',cta:'VER PRODUTOS'};
return type==='reel'?{angle:'Gancho → demonstração → ação',hook:'OLHA ISSO.',headline:'UM PRODUTO. UM MOTIVO PARA PARAR.',support:'Conheça o item, veja os detalhes e decida no seu tempo.',cta:'VER PRODUTOS'}:{angle:'Curiosidade → contexto → ação',hook:'ACHAMOS QUE VOCÊ VAI GOSTAR.',headline:'UM ACHADO DA 2P BOX.',support:'Produto em destaque, apresentado de forma simples e direta.',cta:'VER PRODUTOS'};
}
function wrap(ctx:CanvasRenderingContext2D,text:string,max:number){const words=clean(text).split(' '),lines:string[]=[];let line='';for(const word of words){const next=line?line+' '+word:word;if(ctx.measureText(next).width>max&&line){lines.push(line);line=word}else line=next}if(line)lines.push(line);return lines}
function textBlock(ctx:CanvasRenderingContext2D,text:string,x:number,y:number,max:number,line:number){for(const l of wrap(ctx,text,max)){ctx.fillText(l,x,y);y+=line}return y}
function roundRect(ctx:CanvasRenderingContext2D,x:number,y:number,w:number,h:number,r:number){ctx.beginPath();ctx.roundRect(x,y,w,h,r);ctx.fill()}
function drawProduct(ctx:CanvasRenderingContext2D,img:HTMLImageElement|null,x:number,y:number,w:number,h:number){
ctx.fillStyle='#fff';roundRect(ctx,x,y,w,h,34);ctx.save();ctx.beginPath();ctx.roundRect(x+22,y+22,w-44,h-44,25);ctx.clip();
if(img){const scale=Math.min((w-44)/img.width,(h-44)/img.height);const dw=img.width*scale,dh=img.height*scale;ctx.drawImage(img,x+(w-dw)/2,y+(h-dh)/2,dw,dh)}
else{ctx.fillStyle='#f0f0eb';ctx.fillRect(x+22,y+22,w-44,h-44);ctx.fillStyle='#111';ctx.font='900 56px Arial';ctx.textAlign='center';ctx.fillText('2P',x+w/2,y+h/2+18);ctx.textAlign='left'}ctx.restore();
}
async function loadImage(url?:string|null){if(!url)return null;return await new Promise<HTMLImageElement|null>(resolve=>{const i=new Image();i.crossOrigin='anonymous';i.onload=()=>resolve(i);i.onerror=()=>resolve(null);i.src=url})}
function planFor(input:LocalCreativeInput):CreativePlan{const a=angle(input.objective,input.type);return{...a,strategy:a.angle,direction:'Editorial comercial 2P Box: fundo branco/off-white, amarelo de alto contraste, preto tipográfico, produto em destaque, cartões arredondados, elementos gráficos assimétricos e acabamento limpo.'}}
function draw(ctx:CanvasRenderingContext2D,w:number,h:number,p:LocalCreativeInput['product'],img:HTMLImageElement|null,logo:HTMLImageElement|null,plan:CreativePlan,type:'story'|'reel'){
ctx.fillStyle='#F7F7F3';ctx.fillRect(0,0,w,h);
ctx.fillStyle='#FFC400';roundRect(ctx,-90,55,360,70,35);roundRect(ctx,-45,140,250,46,23);roundRect(ctx,w-245,1660,340,70,35);
if(logo)ctx.drawImage(logo,76,70,250,173);else{ctx.fillStyle='#111';ctx.font='900 58px Arial';ctx.fillText('2P BOX',78,170)}
ctx.fillStyle='#111';ctx.font='900 22px Arial';ctx.fillText(type==='reel'?'REEL  •  2P BOX':'STORY  •  2P BOX',78,294);
ctx.font='900 48px Arial';textBlock(ctx,plan.hook,78,365,w-156,56);
ctx.fillStyle='#FFC400';roundRect(ctx,78,505,w-156,210,34);
ctx.fillStyle='#111';ctx.font='900 70px Arial';textBlock(ctx,plan.headline,108,590,w-216,78);
drawProduct(ctx,img,78,755,w-156,610);
ctx.fillStyle='#111';ctx.font='800 27px Arial';textBlock(ctx,plan.support,82,1430,w-164,38);
ctx.fillStyle='#111';roundRect(ctx,78,1555,w-156,118,28);ctx.fillStyle='#FFC400';ctx.font='900 39px Arial';ctx.fillText(plan.cta,112,1628);ctx.font='800 25px Arial';ctx.fillText('→',w-155,1628);
ctx.fillStyle='#111';ctx.font='900 43px Arial';ctx.fillText(money(p.price),78,1735);
ctx.font='800 20px Arial';ctx.fillStyle='#555';ctx.fillText('2pbox.com.br',78,1775);
ctx.fillStyle='#111';ctx.font='900 18px Arial';ctx.fillText('QUALIDADE',78,1860);ctx.fillText('VARIEDADE',390,1860);ctx.fillText('CONFIANÇA',735,1860);
ctx.fillStyle='#FFC400';for(const x of [50,360,705]){ctx.beginPath();ctx.arc(x,1853,8,0,Math.PI*2);ctx.fill()}
ctx.fillStyle='#111';ctx.fillRect(78,1887,924,3);
}
export async function generateLocalCreative(input:LocalCreativeInput):Promise<LocalCreative>{
const progress=input.onProgress||(()=>{});progress('Diretor-Geral: lendo objetivo, produto e repertório da agência...');
await new Promise(r=>setTimeout(r,90));progress('Estrategista: aplicando funil, storytelling, diversidade criativa e boas práticas de Reels/Stories...');
await new Promise(r=>setTimeout(r,90));progress('Copywriter: criando gancho, headline, benefício e CTA sem inventar especificações...');
const plan=planFor(input);await new Promise(r=>setTimeout(r,90));progress('Diretor de Arte + Designer: aplicando identidade visual 2P Box e composição 9:16...');
const c=document.createElement('canvas');c.width=1080;c.height=1920;const ctx=c.getContext('2d');if(!ctx)throw new Error('Canvas indisponível neste navegador.');
const img=await loadImage(input.product.image_url);const logo=await loadImage('/logo.pnh.png');draw(ctx,1080,1920,input.product,img,logo,plan,input.type);
cacheReady();progress('Revisor: conferindo hierarquia, legibilidade, preço, CTA e consistência da marca...');
return{title:escapeText(input.product.name),strategy:plan.strategy,image:c.toDataURL('image/jpeg',.96),plan};
}
function cacheReady(){try{localStorage.setItem(CACHE_KEY,JSON.stringify({ready:true,updatedAt:Date.now(),knowledge:KNOWLEDGE}))}catch{}}
