import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

const POLLINATIONS_URL = 'https://gen.pollinations.ai';

const TWO_P_BOX_ART_DIRECTION = `
2P BOX — DIREÇÃO DE ARTE FIXA:
- fotografia de produto premium para e-commerce brasileiro, limpa, sofisticada e editorial;
- identidade 2P Box: preto #111111, branco/off-white, amarelo #FFC400 e cinza muito claro;
- iluminação de estúdio suave, realista, sombras naturais e acabamento fotográfico de alto nível;
- fundo minimalista, claro e elegante, com profundidade discreta e poucos elementos geométricos;
- o produto é SEMPRE o protagonista, grande, nítido, inteiro e fiel à foto enviada;
- composição 1:1;
- produto rigorosamente centralizado no eixo horizontal e no centro visual da composição, sem ficar deslocado para esquerda ou direita;
- produto alinhado verticalmente no centro da área de fotografia, com margens equilibradas em todos os lados;
- o produto deve ocupar aproximadamente 55–70% da altura da imagem, sem cortar nenhuma parte importante;
- estética de campanha própria de varejo premium, não de marketplace genérico.
`;

const PRODUCT_RETOUCH = `
RETOQUE FOTOGRÁFICO PROFISSIONAL — MUITO IMPORTANTE:
- a foto enviada é a FONTE DE VERDADE do produto;
- faça um retoque fotográfico realista, como um fotógrafo profissional faria no Photoshop;
- corrija amassados, pequenas deformações, vincos, dobras, marcas de manuseio, sujeira, riscos superficiais e imperfeições causadas pela fotografia, quando isso puder ser feito sem alterar a identidade do produto;
- se a carcaça ou superfície estiver torta ou amassada, reconstrua visualmente a geometria original provável do MESMO produto, deixando-o novo e comercialmente apresentável;
- corrija perspectiva, enquadramento, balanço de branco, exposição, reflexos e iluminação;
- preserve rigorosamente formato, proporções, cor, acabamento, textura, botões, conectores, logotipos, inscrições, embalagem e acessórios que realmente existam;
- NÃO transforme o produto em outro modelo;
- NÃO troque marca, modelo ou design;
- NÃO invente componentes que não estejam na foto;
- NÃO faça uma releitura criativa do produto;
- pense em “foto original restaurada e profissionalizada”, não em “produto parecido gerado do zero”.
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

function parseJsonObject(raw: string) {
  const cleaned = raw
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();

  try {
    return JSON.parse(cleaned);
  } catch {
    const start = cleaned.indexOf('{');
    const end = cleaned.lastIndexOf('}');
    if (start >= 0 && end > start) return JSON.parse(cleaned.slice(start, end + 1));
    throw new Error('A IA não retornou JSON válido.');
  }
}

export async function GET() {
  const key = process.env.POLLINATIONS_API_KEY;
  return NextResponse.json({
    configured: Boolean(key),
    environment: process.env.VERCEL_ENV || 'local',
    runtime: 'nodejs',
  });
}

export async function POST(request: Request) {
  const key = process.env.POLLINATIONS_API_KEY;
  if (!key) {
    return NextResponse.json(
      { error: 'POLLINATIONS_API_KEY não configurada no runtime da Vercel.' },
      { status: 500 },
    );
  }

  try {
    const form = await request.formData();
    const image = form.get('image');
    const productName = String(form.get('productName') || '').trim();
    const category = String(form.get('category') || '').trim();

    if (!(image instanceof File)) {
      return NextResponse.json({ error: 'Envie uma foto do produto.' }, { status: 400 });
    }
    if (!image.type.startsWith('image/')) {
      return NextResponse.json({ error: 'O arquivo enviado precisa ser uma imagem.' }, { status: 400 });
    }
    if (image.size > 10 * 1024 * 1024) {
      return NextResponse.json({ error: 'A foto deve ter no máximo 10 MB.' }, { status: 400 });
    }

    const bytes = Buffer.from(await image.arrayBuffer());
    const sourceDataUrl = imageDataUrl(image, bytes);

    // ETAPA 1 — restauração + fotografia comercial do mesmo produto.
    const imageForm = new FormData();
    imageForm.append('model', 'kontext');
    imageForm.append('image', new Blob([bytes], { type: image.type }), image.name || 'produto.jpg');
    imageForm.append('size', '1024x1024');
    imageForm.append('n', '1');
    imageForm.append('response_format', 'b64_json');
    imageForm.append(
      'prompt',
      `Você é o fotógrafo, retocador e diretor de arte da 2P Box. Sua tarefa é transformar a FOTO REAL enviada em uma fotografia comercial premium do MESMO produto.\n\n${TWO_P_BOX_ART_DIRECTION}\n${PRODUCT_RETOUCH}\n${PRODUCT_SAFETY}\n\nDADOS DO CATÁLOGO:\nProduto: ${productName || 'produto não informado'}\nCategoria: ${category || 'não informada'}\n\nENQUADRAMENTO OBRIGATÓRIO:\n- proporção quadrada 1:1;\n- o produto deve ficar EXATAMENTE NO MEIO DA IMAGEM, centralizado horizontalmente e verticalmente;\n- mantenha distância visual semelhante em todos os quatro lados do produto;\n- não deixe o produto encostado nas bordas;\n- não incline ou desloque a composição sem necessidade;\n- mostre o produto inteiro, sem cortes;\n- remova visualmente o ambiente doméstico ou improvisado da foto original;\n- use cenário de estúdio minimalista e elegante, com superfície/pedestal muito discreto apenas se ajudar a apresentar o produto;\n- iluminação lateral suave, reflexos controlados e sombra realista;\n- resultado final deve parecer uma foto feita para uma campanha profissional da 2P Box.\n\nREGRA CRÍTICA: não renderize nenhum texto novo na imagem. A tipografia e os benefícios serão adicionados pela própria plataforma depois da geração.`,
    );

    const imageResponse = await fetch(`${POLLINATIONS_URL}/v1/images/edits`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}` },
      body: imageForm,
    });

    if (!imageResponse.ok) {
      const details = await imageResponse.text();
      return NextResponse.json(
        { error: `Falha ao gerar imagem pela Pollinations: ${details.slice(0, 700)}` },
        { status: imageResponse.status },
      );
    }

    const imageJson = await imageResponse.json();
    const generatedImage = imageJson?.data?.[0]?.b64_json;
    const generatedUrl = imageJson?.data?.[0]?.url;
    if (!generatedImage && !generatedUrl) {
      return NextResponse.json({ error: 'A Pollinations não retornou uma imagem.' }, { status: 502 });
    }

    let outputBase64 = generatedImage;
    if (!outputBase64 && generatedUrl) {
      const generatedResponse = await fetch(generatedUrl);
      if (!generatedResponse.ok) {
        return NextResponse.json({ error: 'A imagem foi gerada, mas não pôde ser baixada.' }, { status: 502 });
      }
      outputBase64 = Buffer.from(await generatedResponse.arrayBuffer()).toString('base64');
    }

    // ETAPA 2 — visão multimodal. A IA recebe a FOTO ORIGINAL, não apenas o nome do produto.
    // qwen-vision-pro é usado explicitamente porque é um modelo de visão da Pollinations.
    let copy = {
      title: productName,
      shortDescription: '',
      description: '',
      features: [] as string[],
    };

    const visionPrompt = `
Analise cuidadosamente a FOTO ORIGINAL anexada e crie o cadastro comercial desse produto para a loja 2P Box.

REGRAS:
1. A imagem é a principal fonte de verdade. Identifique visualmente o produto antes de escrever.
2. Leia textos, marca, modelo e informações legíveis que apareçam no produto ou na embalagem.
3. Se o produto puder ser identificado com segurança pela imagem, coloque o nome específico no título.
4. Não use o nome atual do catálogo como verdade se a imagem mostrar algo diferente.
5. Não invente especificações. Só informe potência, voltagem, capacidade, medidas, compatibilidade, material, quantidade, certificações ou outras características quando estiverem visíveis na imagem ou forem fornecidas explicitamente.
6. O título deve parecer um título profissional de e-commerce brasileiro: curto, claro e específico.
7. A descrição deve explicar o que é o produto, sua finalidade e os principais atributos realmente percebidos.
8. Escreva em português do Brasil, sem linguagem robótica e sem exageros publicitários.
9. Gere no máximo 3 características objetivas.
10. Se não conseguir identificar algum dado, simplesmente não invente.

CONTEXTO OPCIONAL DO CATÁLOGO:
Nome cadastrado anteriormente: ${productName || 'não informado'}
Categoria cadastrada: ${category || 'não informada'}

RETORNE SOMENTE JSON VÁLIDO, SEM MARKDOWN, exatamente neste formato:
{
  "title": "...",
  "shortDescription": "...",
  "description": "...",
  "features": ["...", "...", "..."]
}
`;

    const textResponse = await fetch(`${POLLINATIONS_URL}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'qwen-vision-pro',
        temperature: 0.2,
        messages: [
          {
            role: 'system',
            content:
              'Você é um especialista em cadastro de produtos para e-commerce. Você possui visão de imagem. Nunca invente informações que não estejam na imagem ou no contexto fornecido.',
          },
          {
            role: 'user',
            content: [
              { type: 'text', text: visionPrompt },
              { type: 'image_url', image_url: { url: sourceDataUrl } },
            ],
          },
        ],
        response_format: { type: 'json_object' },
      }),
    });

    if (!textResponse.ok) {
      const details = await textResponse.text();
      console.error('Pollinations vision error:', details.slice(0, 1000));
      return NextResponse.json({
        imageBase64: outputBase64,
        copy,
        copyError: `A imagem foi criada, mas a IA de catálogo não respondeu: ${details.slice(0, 300)}`,
      });
    }

    const textJson = await textResponse.json();
    const raw = String(textJson?.choices?.[0]?.message?.content || '').trim();

    if (!raw) {
      return NextResponse.json({
        imageBase64: outputBase64,
        copy,
        copyError: 'A IA de visão não retornou conteúdo para o título e a descrição.',
      });
    }

    try {
      const parsed = parseJsonObject(raw);
      copy = {
        title: String(parsed.title || productName || ''),
        shortDescription: String(parsed.shortDescription || ''),
        description: String(parsed.description || ''),
        features: Array.isArray(parsed.features)
          ? parsed.features.map(String).filter(Boolean).slice(0, 3)
          : [],
      };
    } catch (parseError) {
      console.error('Pollinations vision JSON parse error:', parseError, raw.slice(0, 1000));
      return NextResponse.json({
        imageBase64: outputBase64,
        copy,
        copyError: 'A IA analisou a imagem, mas retornou o texto em um formato inesperado. Tente gerar novamente.',
      });
    }

    return NextResponse.json({ imageBase64: outputBase64, copy });
  } catch (error) {
    console.error('Pollinations product generation error', error);
    return NextResponse.json(
      { error: 'Não foi possível processar o produto agora. Tente novamente em alguns instantes.' },
      { status: 500 },
    );
  }
}
