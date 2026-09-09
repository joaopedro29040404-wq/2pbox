import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

const OPENAI_URL = 'https://api.openai.com/v1';

export async function POST(request: Request) {
  const key = process.env.OPENAI_API_KEY;
  if (!key) {
    return NextResponse.json({ error: 'OPENAI_API_KEY não configurada na Vercel.' }, { status: 500 });
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
    const imageBase64 = imageBytes.toString('base64');
    const imageDataUrl = `data:${image.type};base64,${imageBase64}`;

    const imageForm = new FormData();
    imageForm.append('model', 'gpt-image-2');
    imageForm.append('image', new Blob([imageBytes], { type: image.type }), image.name || 'produto.jpg');
    imageForm.append('size', '1024x1024');
    imageForm.append('quality', 'medium');
    imageForm.append('background', 'opaque');
    imageForm.append(
      'prompt',
      `Transforme a foto de produto enviada em uma peça publicitária profissional para a loja 2P Box.\n\n` +
        `DIREÇÃO DE ARTE: e-commerce premium, fotografia de estúdio, iluminação comercial sofisticada, fundo claro com profundidade, detalhes discretos em amarelo 2P Box e preto, produto como protagonista, composição limpa e moderna, formato quadrado 1:1.\n` +
        `O produto físico deve continuar sendo exatamente o mesmo produto da foto. Preserve marca, embalagem, formato, cores, conectores, textos e características visíveis. Não invente peças, especificações, certificações ou acessórios.\n` +
        `Use o nome fornecido apenas como referência editorial: ${productName || 'produto da imagem'}. Categoria: ${category || 'não informada'}.\n` +
        `Crie uma composição semelhante a uma campanha profissional de varejo: título curto e legível na parte superior somente se houver informação confirmada, e 2 ou 3 benefícios visuais somente quando puderem ser inferidos diretamente da embalagem ou do produto. Não invente dados técnicos. Sem marcas d'água, sem logos falsos e sem pessoas.`
    );

    const imageResponse = await fetch(`${OPENAI_URL}/images/edits`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}` },
      body: imageForm,
    });

    if (!imageResponse.ok) {
      const details = await imageResponse.text();
      return NextResponse.json({ error: `Falha ao gerar imagem: ${details}` }, { status: imageResponse.status });
    }

    const imageJson = await imageResponse.json();
    const generatedImage = imageJson?.data?.[0]?.b64_json;
    if (!generatedImage) {
      return NextResponse.json({ error: 'A IA não retornou uma imagem.' }, { status: 502 });
    }

    const textResponse = await fetch(`${OPENAI_URL}/responses`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-5.6-luna',
        input: [
          {
            role: 'user',
            content: [
              {
                type: 'input_text',
                text:
                  `Analise esta foto de produto para uma loja brasileira. Produto informado: ${productName || 'não informado'}. Categoria: ${category || 'não informada'}. ` +
                  `Gere um conteúdo comercial curto e objetivo. Só use informações que estejam visíveis na foto ou no nome/categoria fornecidos. Nunca invente potência, medidas, certificações, compatibilidades ou recursos. Retorne JSON válido com as chaves title, shortDescription, description e features (array de strings).`,
              },
              { type: 'input_image', image_url: imageDataUrl },
            ],
          },
        ],
      }),
    });

    let copy = {
      title: productName,
      shortDescription: '',
      description: '',
      features: [] as string[],
    };

    if (textResponse.ok) {
      const textJson = await textResponse.json();
      const raw = String(textJson?.output_text || '').trim();
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

    return NextResponse.json({ imageBase64: generatedImage, copy });
  } catch (error) {
    console.error('AI product generation error', error);
    return NextResponse.json({ error: 'Não foi possível processar o produto agora.' }, { status: 500 });
  }
}
