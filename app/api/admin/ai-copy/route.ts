import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

const MODEL = 'openrouter/free';
const API_URL = 'https://openrouter.ai/api/v1/chat/completions';

function parseJson(raw: string) {
  const cleaned = raw.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/\s*```$/i, '').trim();
  try { return JSON.parse(cleaned); } catch {
    const start = cleaned.indexOf('{');
    const end = cleaned.lastIndexOf('}');
    if (start >= 0 && end > start) return JSON.parse(cleaned.slice(start, end + 1));
    throw new Error('A IA não retornou JSON válido.');
  }
}

export async function GET() {
  return NextResponse.json({
    configured: Boolean(process.env.OPENROUTER_API_KEY),
    model: MODEL,
    provider: 'OpenRouter Free',
  });
}

export async function POST(request: Request) {
  const key = process.env.OPENROUTER_API_KEY;
  if (!key) {
    return NextResponse.json(
      { error: 'OPENROUTER_API_KEY não configurada na Vercel.' },
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
      return NextResponse.json({ error: 'O arquivo precisa ser uma imagem.' }, { status: 400 });
    }
    if (image.size > 10 * 1024 * 1024) {
      return NextResponse.json({ error: 'A foto deve ter no máximo 10 MB.' }, { status: 400 });
    }

    const bytes = Buffer.from(await image.arrayBuffer());
    const base64 = bytes.toString('base64');
    const imageDataUrl = `data:${image.type};base64,${base64}`;

    const prompt = `Você é o especialista de catálogo da 2P Box, um e-commerce brasileiro.

ANALISE A FOTO DO PRODUTO COM ATENÇÃO antes de escrever qualquer coisa.
Seu trabalho é identificar o produto e gerar TÍTULO e DESCRIÇÃO comerciais precisos para o cadastro da loja.

REGRAS DE PRECISÃO:
1. A FOTO é a fonte principal de verdade.
2. Leia todos os textos legíveis na embalagem ou no próprio produto: marca, modelo, nome, códigos, capacidade, potência, quantidade e outras especificações.
3. Combine texto visível + aparência física do produto para identificar corretamente o item.
4. Não invente nenhuma especificação. Se não estiver visível ou não puder ser confirmada, NÃO coloque.
5. Se houver um nome informado pelo administrador, use-o somente como pista. Se estiver errado, corrija de acordo com a foto.
6. O título deve ser específico e comercial, em português do Brasil, normalmente no formato: tipo de produto + marca + modelo/variante quando identificáveis.
7. A descrição deve explicar claramente o que é o produto, sua finalidade e as características confirmadas na foto.
8. Se a foto mostrar embalagem com informações importantes, use essas informações na descrição.
9. Não escreva “na imagem”, “aparenta ser”, “provavelmente”, “a IA identificou” ou qualquer comentário sobre o processo de análise.
10. Não invente garantia, certificação, dimensões, compatibilidade, voltagem, material ou quantidade.
11. Gere de 2 a 5 características somente quando forem confirmadas visualmente.
12. Escreva como conteúdo final pronto para uma página de produto de e-commerce.

CONTEXTO OPCIONAL:
Nome informado pelo administrador: ${productName || 'não informado'}
Categoria selecionada: ${category || 'não informada'}

RETORNE SOMENTE JSON válido, sem markdown:
{
  "title": "título preciso do produto",
  "description": "descrição comercial precisa e objetiva",
  "features": ["característica confirmada 1", "característica confirmada 2"]
}`;

    const response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${key}`,
        'HTTP-Referer': 'https://2pbox.vercel.app',
        'X-Title': '2P Box',
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: prompt },
              { type: 'image_url', image_url: { url: imageDataUrl } },
            ],
          },
        ],
        temperature: 0.15,
        response_format: { type: 'json_object' },
      }),
    });

    const data = await response.json();
    if (!response.ok) {
      const detail = data?.error?.message || 'Falha ao consultar a IA gratuita.';
      return NextResponse.json({ error: detail }, { status: response.status });
    }

    const raw = data?.choices?.[0]?.message?.content?.trim();
    if (!raw) {
      return NextResponse.json({ error: 'A IA não retornou uma análise da imagem.' }, { status: 502 });
    }

    const parsed = parseJson(raw);
    return NextResponse.json({
      copy: {
        title: String(parsed.title || productName || ''),
        description: String(parsed.description || ''),
        features: Array.isArray(parsed.features)
          ? parsed.features.map(String).filter(Boolean).slice(0, 5)
          : [],
      },
    });
  } catch (error) {
    console.error('OpenRouter product copy error:', error);
    return NextResponse.json(
      { error: 'Não foi possível analisar a foto agora. Tente novamente.' },
      { status: 500 },
    );
  }
}
