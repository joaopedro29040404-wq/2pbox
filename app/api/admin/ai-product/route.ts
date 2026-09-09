import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

const POLLINATIONS_URL = 'https://gen.pollinations.ai';

const TWO_P_BOX_ART_DIRECTION = `
2P BOX — DIREÇÃO DE ARTE FIXA:
- fotografia de produto premium para e-commerce brasileiro, limpa, sofisticada e editorial;
- identidade 2P Box: preto #111111, branco/off-white, amarelo #FFC400 e cinza muito claro;
- iluminação de estúdio suave, realista, sombras naturais e acabamento fotográfico de alto nível;
- fundo minimalista, claro e elegante, com profundidade discreta e poucos elementos geométricos;
- produto é SEMPRE o protagonista, grande, nítido, inteiro e fiel à foto enviada;
- composição 1:1 com espaço negativo generoso no topo e na parte inferior para uma camada gráfica posterior;
- produto centralizado levemente abaixo do centro, ocupando aproximadamente 55–70% da altura;
- estética de campanha própria de varejo premium, não de marketplace genérico.
`;

const PRODUCT_SAFETY = `
PRESERVAÇÃO ABSOLUTA DO PRODUTO:
- use a imagem enviada como fonte de verdade visual;
- preserve exatamente marca, modelo, formato, cor, textura, botões, conectores, embalagem e acessórios visíveis;
- não substitua o produto por outro parecido;
- não invente detalhes do produto;
- não altere logotipos ou textos que já existam fisicamente no produto;
- não adicione pessoas, mãos, marcas, selos, certificados ou acessórios inexistentes;
- não crie texto publicitário dentro da imagem;
- NÃO coloque título, descrição, benefícios, letras decorativas, watermark ou logo 2P Box na cena;
- a imagem gerada deve ser somente a fotografia profissional do produto.
`;

function imageDataUrl(image: File, bytes: Buffer) {
  return `data:${image.type};base64,${bytes.toString('base64')}`;
}

export async function GET() {
  const key = process.env.POLLINATIONS_API_KEY;
  return NextResponse.json({ configured: Boolean(key), environment: process.env.VERCEL_ENV || 'local', runtime: 'nodejs' });
}

export async function POST(request: Request) {
  const key = process.env.POLLINATIONS_API_KEY;
  if (!key) return NextResponse.json({ error: 'POLLINATIONS_API_KEY não configurada no runtime da Vercel.' }, { status: 500 });

  try {
    const form = await request.formData();
    const image = form.get('image');
    const productName = String(form.get('productName') || '').trim();
    const category = String(form.get('category') || '').trim();

    if (!(image instanceof File)) return NextResponse.json({ error: 'Envie uma foto do produto.' }, { status: 400 });
    if (!image.type.startsWith('image/')) return NextResponse.json({ error: 'O arquivo enviado precisa ser uma imagem.' }, { status: 400 });
    if (image.size > 10 * 1024 * 1024) return NextResponse.json({ error: 'A foto deve ter no máximo 10 MB.' }, { status: 400 });

    const bytes = Buffer.from(await image.arrayBuffer());
    const sourceDataUrl = imageDataUrl(image, bytes);

    const imageForm = new FormData();
    imageForm.append('model', 'kontext');
    imageForm.append('image', new Blob([bytes], { type: image.type }), image.name || 'produto.jpg');
    imageForm.append('size', '1024x1024');
    imageForm.append('n', '1');
    imageForm.append('response_format', 'b64_json');
    imageForm.append('prompt', `
Você é o fotógrafo e diretor de arte da 2P Box. Transforme a foto enviada em uma fotografia comercial premium do MESMO produto.

${TWO_P_BOX_ART_DIRECTION}
${PRODUCT_SAFETY}

DADOS DO CATÁLOGO:
Produto: ${productName || 'produto não informado'}
Categoria: ${category || 'não informada'}

ENQUADRAMENTO OBRIGATÓRIO:
- proporção quadrada 1:1;
- deixe aproximadamente 25% de área visual limpa no topo e 15% na parte inferior;
- coloque o produto no centro/inferior, com escala generosa e boa separação do fundo;
- remova visualmente o ambiente doméstico ou improvisado da foto original;
- use cenário de estúdio minimalista, com superfície/pedestal muito discreto apenas se ajudar a apresentar o produto;
- iluminação lateral suave, reflexos controlados e sombra realista;
- resultado final deve parecer uma foto feita para uma campanha profissional da 2P Box.

REGRA CRÍTICA: não renderize nenhum texto novo na imagem. A tipografia e os benefícios serão adicionados pela própria plataforma depois da geração.
`);

    const imageResponse = await fetch(`${POLLINATIONS_URL}/v1/images/edits`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}` },
      body: imageForm,
    });

    if (!imageResponse.ok) {
      const details = await imageResponse.text();
      return NextResponse.json({ error: `Falha ao gerar imagem pela Pollinations: ${details.slice(0, 700)}` }, { status: imageResponse.status });
    }

    const imageJson = await imageResponse.json();
    const generatedImage = imageJson?.data?.[0]?.b64_json;
    const generatedUrl = imageJson?.data?.[0]?.url;
    if (!generatedImage && !generatedUrl) return NextResponse.json({ error: 'A Pollinations não retornou uma imagem.' }, { status: 502 });

    let outputBase64 = generatedImage;
    if (!outputBase64 && generatedUrl) {
      const generatedResponse = await fetch(generatedUrl);
      if (!generatedResponse.ok) return NextResponse.json({ error: 'A imagem foi gerada, mas não pôde ser baixada.' }, { status: 502 });
      outputBase64 = Buffer.from(await generatedResponse.arrayBuffer()).toString('base64');
    }

    let copy = { title: productName, shortDescription: '', description: '', features: [] as string[] };
    const textResponse = await fetch(`${POLLINATIONS_URL}/v1/chat/completions`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'gemini-3-flash',
        messages: [
          { role: 'system', content: 'Você é o redator de e-commerce da 2P Box. Escreva em português do Brasil. Analise a foto e os dados do catálogo. Nunca invente especificações, potência, medidas, compatibilidades, certificações ou benefícios não confirmados.' },
          { role: 'user', content: [
            { type: 'text', text: `Produto: ${productName || 'não informado'}. Categoria: ${category || 'não informada'}. Retorne SOMENTE JSON válido com title, shortDescription, description e features. features deve ter no máximo 3 itens curtos, objetivos e visualmente bons para uma faixa de benefícios. O título deve ser comercial e claro.` },
            { type: 'image_url', image_url: { url: sourceDataUrl } },
          ] },
        ],
      }),
    });

    if (textResponse.ok) {
      const textJson = await textResponse.json();
      const raw = String(textJson?.choices?.[0]?.message?.content || '').trim();
      try {
        const parsed = JSON.parse(raw.replace(/^```json\s*/i, '').replace(/\s*```$/i, '').trim());
        copy = {
          title: String(parsed.title || productName),
          shortDescription: String(parsed.shortDescription || ''),
          description: String(parsed.description || ''),
          features: Array.isArray(parsed.features) ? parsed.features.map(String).slice(0, 3) : [],
        };
      } catch {
        copy.description = raw;
      }
    }

    return NextResponse.json({ imageBase64: outputBase64, copy });
  } catch (error) {
    console.error('Pollinations product generation error', error);
    return NextResponse.json({ error: 'Não foi possível processar o produto agora. Tente novamente em alguns instantes.' }, { status: 500 });
  }
}
