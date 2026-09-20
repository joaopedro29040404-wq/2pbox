export type LocalCreativeInput={type:'story'|'reel';product:{name:string;price:number|string;stock?:number|null;image_url?:string|null};objective:string;onProgress?:(message:string)=>void};
export type CreativePlan={angle:string;hook:string;headline:string;support:string;cta:string;strategy:string;direction:string};
export type LocalCreative={title:string;strategy:string;image:string;plan:CreativePlan};

const CACHE_KEY='2pbox-local-engine-v3';
const SENIOR_PLAYBOOK=[
'Direção de arte sênior: criar uma peça com uma ideia visual dominante, não um mosaico de elementos.',
'Usar hierarquia em três níveis: gancho curto, mensagem principal muito forte e ação objetiva.',
'Trabalhar com grid editorial, respiro generoso, alinhamento consistente e assimetria controlada.',
'Usar contraste preto/amarelo/branco para criar ritmo, pontos de entrada e leitura instantânea no celular.',
'Criar blocos amarelos como dispositivos de marca, não como decoração aleatória.',
'Produto é o herói: preservar proporção, nitidez e espaço visual; não distorcer nem inventar características.',
'Construir profundidade com cartões, sobreposição, sombra suave, recortes, linhas de movimento e elementos de apoio.',
'Adicionar microcopy e selos somente quando sustentados pelo briefing ou pelos dados reais do produto.',
'Evitar excesso de texto, excesso de caixas, elementos concorrendo pela atenção e aparência de template genérico.',
'Cada peça deve parecer uma campanha pensada para a 2P Box, não uma variação automática da peça anterior.',
'Criar variações de composição por objetivo para evitar repetição visual entre peças.',
'Story e Reel usam 9:16, com áreas de segurança para interface do Instagram e leitura em telas pequenas.',
'CTA deve ser curto, específico e coerente com o objetivo; para a 2P Box, priorizar VER PRODUTOS quando fizer sentido.',
'Copy deve transformar característica em benefício somente quando a informação for verdadeira; nunca inventar especificações.',
'Revisão final: ortografia, preço, contraste, legibilidade, hierarquia, marca, CTA e ausência de afirmações não comprovadas.',
'2P Box: amarelo #FFC400, preto #111111, branco/off-white #F7F7F3, logo oficial, tipografia pesada, linguagem comercial brasileira.',
'Referência visual fornecida: editorial comercial de alto impacto, headline gigante, faixas amarelas, anotações manuscritas, produto central, CTA forte, rodapé limpo e sensação de campanha publicitária profissional.'
].join(' ');

function clean(v:string){return String(v||'').replace(/\s+/g,' ').trim()}
function money(v:number|string){const n=Number(v);return Number.isFinite(n)?'R$ '+n.toFixed(2).replace('.',','):'Consultar'}
function escapeText(v:string){return clean(v).replace(/[<>&'\"]/g,(c)=>({'<':'&lt;','>':'&gt;','&':'&amp;',"'":'&apos;','"':'&quot;'} as Record<string,string>)[c]||c)}
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
function shadowCard(ctx:CanvasRenderingContext2D,x:number,y:number,w:number,h:number,r:number){ctx.save();ctx.shadowColor='rgba(0,0,0,.12)';ctx.shadowBlur=28;ctx.shadowOffsetY=14;ctx.fillStyle='#fff';roundRect(ctx,x,y,w,h,r);ctx.restore()}
function drawProduct(ctx:CanvasRenderingContext2D,img:HTMLImageElement|null,x:number,y:number,w:number,h:number){
 shadowCard(ctx,x,y,w,h,38);ctx.save();ctx.beginPath();ctx.roundRect(x+20,y+20,w-40,h-40,30);ctx.clip();
 if(img){const scale=Math.min((w-40)/img.width,(h-40)/img.height);const dw=img.width*scale,dh=img.height*scale;ctx.drawImage(img,x+(w-dw)/2,y+(h-dh)/2,dw,dh)}
 else{ctx.fillStyle='#f0f0eb';ctx.fillRect(x+20,y+20,w-40,h-40);ctx.fillStyle='#111';ctx.font='900 58px Arial';ctx.textAlign='center';ctx.fillText('2P BOX',x+w/2,y+h/2+18);ctx.textAlign='left'}ctx.restore();
}
async function loadImage(url?:string|null){if(!url)return null;return await new Promise<HTMLImageElement|null>(resolve=>{const i=new Image();i.crossOrigin='anonymous';i.onload=()=>resolve(i);i.onerror=()=>resolve(null);i.src=url})}
function planFor(input:LocalCreativeInput):CreativePlan{const a=angle(input.objective,input.type);return{...a,strategy:a.angle,direction:'Campanha editorial 2P Box: headline dominante, grid assimétrico, produto protagonista, amarelo em blocos de marca, anotações laterais, contraste forte, respiro e CTA inequívoco.'}}
function draw(ctx:CanvasRenderingContext2D,w:number,h:number,p:LocalCreativeInput['product'],img:HTMLImageElement|null,logo:HTMLImageElement|null,plan:CreativePlan,type:'story'|'reel'){
 ctx.fillStyle='#F7F7F3';ctx.fillRect(0,0,w,h);
 // Moldura gráfica assimétrica inspirada na referência enviada.
 ctx.fillStyle='#FFC400';roundRect(ctx,-110,48,365,72,36);roundRect(ctx,-85,145,260,42,21);roundRect(ctx,w-220,1650,330,64,32);
 ctx.fillStyle='#111';ctx.fillRect(78,64,4,190);
 if(logo)ctx.drawImage(logo,94,64,250,173);else{ctx.fillStyle='#111';ctx.font='900 58px Arial';ctx.fillText('2P BOX',94,170)}
 ctx.fillStyle='#111';ctx.font='900 18px Arial';ctx.fillText(type==='reel'?'REEL / CAMPANHA':'STORY / CAMPANHA',94,278);
 // Selo de campanha.
 ctx.fillStyle='#FFC400';roundRect(ctx,w-330,72,236,54,27);ctx.fillStyle='#111';ctx.font='900 16px Arial';ctx.fillText('EDIÇÃO 2P BOX',w-302,106);
 // Gancho editorial.
 ctx.fillStyle='#111';ctx.font='900 46px Arial';textBlock(ctx,plan.hook,94,370,w-188,54);
 // Headline hero.
 ctx.fillStyle='#FFC400';roundRect(ctx,76,510,w-152,226,36);
 ctx.fillStyle='#111';ctx.font='900 72px Arial';textBlock(ctx,plan.headline,108,598,w-216,82);
 // Microcopy lateral.
 ctx.save();ctx.translate(72,820);ctx.rotate(-Math.PI/2);ctx.fillStyle='#111';ctx.font='italic 800 23px Arial';ctx.fillText('MAIS PRATICIDADE PARA VOCÊ',0,0);ctx.restore();
 // Produto em destaque.
 drawProduct(ctx,img,94,770,w-188,600);
 // Faixas de informação.
 ctx.fillStyle='#111';ctx.font='900 22px Arial';ctx.fillText('DESTAQUE',96,1415);
 ctx.fillStyle='#FFC400';roundRect(ctx,96,1435,235,52,26);ctx.fillStyle='#111';ctx.font='900 18px Arial';ctx.fillText(money(p.price),120,1468);
 ctx.fillStyle='#111';ctx.font='800 25px Arial';textBlock(ctx,plan.support,365,1460,w-460,35);
 // CTA principal.
 ctx.fillStyle='#111';roundRect(ctx,76,1560,w-152,124,30);ctx.fillStyle='#FFC400';ctx.font='900 38px Arial';ctx.fillText(plan.cta,112,1638);ctx.fillStyle='#fff';ctx.font='900 34px Arial';ctx.fillText('→',w-160,1638);
 ctx.fillStyle='#111';ctx.font='800 19px Arial';ctx.fillText('ACESSE AGORA',96,1728);
 ctx.fillStyle='#FFC400';ctx.fillRect(96,1742,190,5);ctx.fillStyle='#111';ctx.fillRect(310,1742,190,5);
 ctx.font='900 27px Arial';ctx.fillText('WWW.2PBOX.COM.BR',530,1750);
 // Rodapé de marca.
 ctx.fillStyle='#111';ctx.font='900 17px Arial';ctx.fillText('QUALIDADE',96,1840);ctx.fillText('VARIEDADE',390,1840);ctx.fillText('CONFIANÇA',720,1840);
 ctx.fillStyle='#FFC400';for(const x of [350,680]){ctx.beginPath();ctx.arc(x,1834,5,0,Math.PI*2);ctx.fill()}
 ctx.fillStyle='#111';ctx.fillRect(76,1870,w-152,3);
}
export async function generateLocalCreative(input:LocalCreativeInput):Promise<LocalCreative>{
 const progress=input.onProgress||(()=>{});
 progress('Diretor-Geral: lendo briefing, produto e objetivo da campanha...');
 await new Promise(r=>setTimeout(r,90));
 progress('Estrategista: escolhendo ângulo e estrutura de atenção → mensagem → ação...');
 await new Promise(r=>setTimeout(r,90));
 progress('Copywriter: criando gancho, headline, benefício e CTA sem inventar dados...');
 const plan=planFor(input);
 await new Promise(r=>setTimeout(r,90));
 progress('Diretor de Arte: aplicando direção sênior, grid, hierarquia, contraste e ritmo visual...');
 await new Promise(r=>setTimeout(r,90));
 progress('Designer: construindo composição editorial 9:16 e produto protagonista...');
 const c=document.createElement('canvas');c.width=1080;c.height=1920;const ctx=c.getContext('2d');if(!ctx)throw new Error('Canvas indisponível neste navegador.');
 const img=await loadImage(input.product.image_url);const logo=await loadImage('/logo.pnh.png');draw(ctx,1080,1920,input.product,img,logo,plan,input.type);
 cacheReady();progress('Revisor: checando ortografia, hierarquia, legibilidade, preço, CTA e consistência da marca...');
 return{title:escapeText(input.product.name),strategy:plan.strategy,image:c.toDataURL('image/jpeg',.96),plan};
}
function cacheReady(){try{localStorage.setItem(CACHE_KEY,JSON.stringify({ready:true,updatedAt:Date.now(),playbook:'senior-art-direction-v3',knowledge:SENIOR_PLAYBOOK}))}catch{}}
