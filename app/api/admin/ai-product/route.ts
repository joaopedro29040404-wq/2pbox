import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

const POLLINATIONS_URL = 'https://gen.pollinations.ai';

const TWO_P_BOX_ART_DIRECTION = `
IDENTIDADE VISUAL 2P BOX:
- estética de e-commerce contemporâneo, premium, limpa e editorial;
- paleta principal: preto #111111, branco/off-white e amarelo 2P Box #FFC400;
- muito espaço negativo e composição arejada;
- tipografia sans-serif forte, moderna e de alto impacto;
- títulos grandes, preferencialmente em preto, com uma palavra ou linha de destaque em amarelo;
- pequenos detalhes gráficos amarelos, linhas finas e ícones minimalistas;
- fotografia de produto realista, iluminação de estúdio suave e sombras naturais;
- fundo claro com profundidade discreta e elementos geométricos/arquitetônicos muito sutis;
- produto sempre como protagonista, grande e perfeitamente legível;
- faixa inferior opcional em preto com a marca 2P BOX e pequenos indicadores de categorias;
- aparência de campanha de varejo profissional, não de marketplace genérico;
- formato quadrado 1:1, pensado para catálogo, anúncio e compartilhamento social.
`;

const PRODUCT_SAFETY = `
PRESERVAÇÃO DO PRODUTO:
- mantenha exatamente o produto físico enviado como referência;
- não troque marca, modelo, formato, cor, conectores, embalagem ou acessórios visíveis;
- não invente potência, certificações, compatibilidades, medidas ou recursos;
- não crie logotipos de marcas que não estejam presentes na foto;
- não altere textos visíveis do produto;
- não adicione pessoas;
- não use marca d'água.
`;

function getImageDataUrl(image: File, bytes: Buffer) {
  return `data:${image.type};base64,${bytes.toString('base64')}`;
}

// Diagnóstico seguro: nunca retorna a chave, apenas informa se ela existe no runtime.
export async function GET() {
  const key = process.env.POLLINATIONS_API_KEY;
  return NextResponse.json({
    configured: Boolean(key),
    environment: process.env.VERCEL_ENV || 'local',
    runtime: 'nodejs',
    message: key ? 'POLLINATIONS_API_KEY está disponível neste runtime.' : 'POLLINATIONS_API_KEY está ausente neste runtime.',
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

    const imageBytes = Buffer.from(await image.arrayBuffer());
    const imageDataUrl = getImageDataUrl(image, imageBytes);

    const imageForm = new FormData();
    imageForm.append('model', 'kontext');
    imageForm.append('image', new Blob([imageBytes], { type: image.type }), image.name || 'produto.jpg');
    imageForm.append('size', '1024x1024');
    imageForm.append('n', '1');
    imageForm.append('response_format', 'b64_json');
    imageForm.append(
      'prompt',
      `Transforme esta foto simples em uma peça publicitária profissional da 2P Box.\n\n` +
        TWO_P_BOX_ART_DIRECTION +
        PRODUCT_SAFETY +
        `\nPRODUTO INFORMADO PELO CATÁLOGO: ${productName || 'produto da foto'}.\n` +
        `CATEGORIA: ${category || 'não informada'}.\n\n` +
        `COMPOSIÇÃO: crie uma cena de estúdio sofisticada e limpa. Recorte visualmente o produto do ambiente original quando necessário, corrija perspectiva e iluminação sem mudar o produto, coloque-o em uma superfície/pedestal discreto e use profundidade de campo suave. Crie hierarquia editorial semelhante a uma campanha de produto da própria 2P Box.\n` +
        `TEXTO DA ARTE: use somente informações confirmadas pelo nome fornecido ou claramente visíveis na foto. Se houver informação suficiente, inclua um título curto no topo e até 3 benefícios objetivos. Se não houver informação suficiente, prefira uma composição visual limpa a inventar texto.\n` +
        `Não faça uma cópia literal de nenhuma campanha existente. A referência é somente a linguagem visual: preto, branco, amarelo, tipografia forte, espaço negativo, produto protagonista e acabamento premium.`,
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

    let copy = {
      title: productName,
      shortDescription: '',
      description: '',
      features: [] as string[],
    };

    const textResponse = await fetch(`${POLLINATIONS_URL}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gemini-3-flash',
        messages: [
          {
            role: 'system',
            content:
              'Você é o redator de e-commerce da 2P Box. Analise fotos de produtos e escreva conteúdo comercial claro em português do Brasil. Nunca invente especificações. Se algo não puder ser confirmado pela imagem ou pelos dados fornecidos, omita.',
          },
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text:
                  `Produto cadastrado: ${productName || 'não informado'}. Categoria: ${category || 'não informada'}. ` +
                  `Analise a imagem e retorne SOMENTE JSON válido com as chaves title, shortDescription, description e features (array de no máximo 5 strings). ` +
                  `O título deve ser comercial sem exageros; a descrição deve ser objetiva e adequada a uma loja brasileira. ` +
                  `Não invente potência, medidas, certificações, compatibilidades ou recursos.`,
              },
              { type: 'image_url', image_url: { url: imageDataUrl } },
            ],
          },
        ],
      }),
    });

    if (textResponse.ok) {
      const textJson = await textResponse.json();
      const raw = String(textJson?.choices?.[0]?.message?.content || '').trim();
      try {
        const cleaned = raw.replace(/^```json\s*/i, '').replace(/\s*```$/i, '').trim();
        const parsed = JSON.parse(cleaned);
        copy = {
          title: String(parsed.title || productName),
          shortDescription: String(parsed.shortDescription || ''),
          description: String(parsed.description || ''),
          features: Array.isArray(parsed.features) ? parsed.features.map(String).slice(0, 5) : [],
        };
      } catch {
        copy.shortDescription = raw.slice(0, 180);
        copy.description = raw;
      }
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
