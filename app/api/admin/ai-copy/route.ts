import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

const MODEL = 'gemini-2.5-flash';
const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;

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
  return NextResponse.json({ configured: Boolean(process.env.GEMINI_API_KEY), model: MODEL });
}

export async function POST(request: Request) {
  const key = process.env.GEMINI_API_KEY;
  if (!key) return NextResponse.json({ error: 'GEMINI_API_KEY não configurada na Vercel.' }, { status: 500 });

  try {
    const form = await request.formData();
    const image = form.get('image');
    const productName = String(form.get('productName') || '').trim();
    const category = String(form.get('category') || '').trim();

    if (!(image instanceof File)) return NextResponse.json({ error: 'Envie uma foto do produto.' }, { status: 400 });
    if (!image.type.startsWith('image/')) return NextResponse.json({ error: 'O arquivo precisa ser uma imagem.' }, { status: 400 });
    if (image.size > 10 * 1024 * 1024) return NextResponse.json({ error: 'A foto deve ter no máximo 10 MB.' }, { status: 400 });

    const bytes = Buffer.from(await image.arrayBuffer());
    const base64 = bytes.toString('base64');

    const prompt = `Você é o responsável pelo cadastro de produtos da 2P Box, um e-commerce brasileiro.

Analise a FOTO DO PRODUTO enviada. O objetivo é preencher automaticamente apenas TÍTULO e DESCRIÇÃO com base no que realmente pode ser identificado na imagem.

REGRAS DE PRECISÃO — SIGA RIGOROSAMENTE:
1. A imagem é a fonte principal de verdade. Observe o produto e, quando houver, leia marca, modelo, nome, códigos e informações visíveis na embalagem.
2. Identifique o produto pelo conjunto de evidências visuais, não apenas por uma palavra isolada.
3. Se houver texto legível na embalagem, use-o para tornar o título específico.
4. Não invente potência, voltagem, capacidade, dimensões, compatibilidade, material, quantidade, certificações, garantia ou qualquer especificação que não esteja visível na imagem.
5. Não transforme uma suposição em fato. Quando uma característica não puder ser confirmada, omita-a.
6. O título deve ser curto, claro e específico para um catálogo de e-commerce brasileiro. Inclua marca/modelo quando estiverem identificáveis.
7. A descrição deve explicar o que é o produto, para que serve e as características visíveis mais relevantes, em português do Brasil.
8. Não use frases vazias como “produto de alta qualidade” se a imagem não fornecer essa informação.
9. Não mencione que você é uma IA e não diga “na imagem é possível ver”. Escreva como uma descrição pronta para a loja.
10. Se a imagem não permitir identificar o produto com segurança, seja conservador e use somente o que for claramente observável.
11. Gere de 2 a 4 características objetivas somente quando estiverem confirmadas pela imagem.

CONTEXTO OPCIONAL DO CADASTRO (pode estar vazio):
Nome informado pelo administrador: ${productName || 'não informado'}
Categoria selecionada: ${category || 'não informada'}

IMPORTANTE: o nome informado pelo administrador é apenas uma pista. Se entrar em conflito com o que aparece na foto, priorize a foto.

Retorne SOMENTE JSON válido, sem markdown, exatamente com estas chaves:
{
  "title": "título do produto",
  "description": "descrição comercial precisa",
  "features": ["característica confirmada 1", "característica confirmada 2"]
}`;

    const response = await fetch(`${API_URL}?key=${encodeURIComponent(key)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          role: 'user',
          parts: [
            { text: prompt },
            { inline_data: { mime_type: image.type, data: base64 } },
          ],
        }],
        generationConfig: {
          temperature: 0.15,
          responseMimeType: 'application/json',
          responseSchema: {
            type: 'OBJECT',
            properties: {
              title: { type: 'STRING' },
              description: { type: 'STRING' },
              features: { type: 'ARRAY', items: { type: 'STRING' } },
            },
            required: ['title', 'description', 'features'],
          },
        },
      }),
    });

    const data = await response.json();
    if (!response.ok) {
      const detail = data?.error?.message || 'Falha ao consultar o Gemini.';
      return NextResponse.json({ error: detail }, { status: response.status });
    }

    const raw = data?.candidates?.[0]?.content?.parts?.map((part: { text?: string }) => part.text || '').join('').trim();
    if (!raw) return NextResponse.json({ error: 'O Gemini não retornou uma análise da imagem.' }, { status: 502 });

    const parsed = parseJson(raw);
    return NextResponse.json({
      copy: {
        title: String(parsed.title || productName || ''),
        description: String(parsed.description || ''),
        features: Array.isArray(parsed.features) ? parsed.features.map(String).filter(Boolean).slice(0, 4) : [],
      },
    });
  } catch (error) {
    console.error('Gemini product copy error:', error);
    return NextResponse.json({ error: 'Não foi possível analisar a foto agora. Tente novamente.' }, { status: 500 });
  }
}
