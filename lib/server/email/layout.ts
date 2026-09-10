import { getSiteUrl, getStoreWhatsApp } from '../env';

export const BRAND = {
  yellow: '#ffc400',
  gold: '#9a7200',
  ink: '#111111',
  paper: '#ffffff',
  canvas: '#f6f6f3',
  line: '#e7e7e7',
  muted: '#707070',
};

export function escapeHtml(value: unknown) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function money(value: unknown) {
  const amount = Number(value || 0);
  return `R$ ${(Number.isFinite(amount) ? amount : 0).toFixed(2).replace('.', ',')}`;
}

export function shortOrderId(orderId: unknown) {
  return String(orderId || '').slice(0, 8).toUpperCase();
}

export function formatDate(value: unknown) {
  const date = value ? new Date(String(value)) : new Date();
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short', timeZone: 'America/Sao_Paulo' }).format(date);
}

export function button(label: string, href: string, variant: 'primary' | 'ghost' = 'primary') {
  const background = variant === 'primary' ? BRAND.yellow : BRAND.paper;
  const color = BRAND.ink;
  const border = variant === 'primary' ? BRAND.yellow : '#111111';
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 6px 10px 0;display:inline-table;">
    <tr><td align="center" bgcolor="${background}" style="border:1px solid ${border};border-radius:8px;">
      <a href="${escapeHtml(href)}" style="display:inline-block;padding:14px 22px;color:${color};font:900 11px/1 Arial,Helvetica,sans-serif;letter-spacing:1.2px;text-transform:uppercase;text-decoration:none;">${escapeHtml(label)}</a>
    </td></tr>
  </table>`;
}

export function panel(inner: string) {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:22px 0;border:1px solid ${BRAND.line};border-radius:12px;background:${BRAND.canvas};">
    <tr><td style="padding:18px 20px;">${inner}</td></tr>
  </table>`;
}

export function dataRows(rows: Array<[string, string]>) {
  const cells = rows
    .filter(([, value]) => value)
    .map(
      ([label, value]) => `<tr>
        <td style="padding:9px 0;border-bottom:1px solid ${BRAND.line};font:700 10px/1.4 Arial,Helvetica,sans-serif;letter-spacing:1.1px;text-transform:uppercase;color:${BRAND.muted};width:45%;">${escapeHtml(label)}</td>
        <td style="padding:9px 0;border-bottom:1px solid ${BRAND.line};font:700 13px/1.5 Arial,Helvetica,sans-serif;color:${BRAND.ink};text-align:right;">${value}</td>
      </tr>`,
    )
    .join('');
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">${cells}</table>`;
}

export function itemsTable(items: Array<{ product_name?: string; quantity?: number; unit_price?: number }>, total?: unknown) {
  if (!items?.length) return '';
  const rows = items
    .map(
      (item) => `<tr>
        <td style="padding:11px 0;border-bottom:1px solid ${BRAND.line};font:600 13px/1.45 Arial,Helvetica,sans-serif;color:${BRAND.ink};">
          <strong style="font-weight:800;">${Number(item.quantity || 1)}×</strong> ${escapeHtml(item.product_name || 'Produto')}
        </td>
        <td style="padding:11px 0;border-bottom:1px solid ${BRAND.line};font:800 13px/1.45 Arial,Helvetica,sans-serif;color:${BRAND.ink};text-align:right;white-space:nowrap;">
          ${money(Number(item.unit_price || 0) * Number(item.quantity || 1))}
        </td>
      </tr>`,
    )
    .join('');
  const totalRow =
    total === undefined
      ? ''
      : `<tr>
          <td style="padding:16px 0 0;font:800 11px/1 Arial,Helvetica,sans-serif;letter-spacing:1.2px;text-transform:uppercase;color:${BRAND.muted};">Total do pedido</td>
          <td style="padding:16px 0 0;font:900 22px/1 Arial,Helvetica,sans-serif;color:${BRAND.ink};text-align:right;white-space:nowrap;">${money(total)}</td>
        </tr>`;
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:20px 0 0;">${rows}${totalRow}</table>`;
}

export function stepper(current: string) {
  const steps: Array<[string, string]> = [
    ['pending', 'Recebido'],
    ['confirmed', 'Pago'],
    ['preparing', 'Preparando'],
    ['ready', 'Pronto'],
    ['completed', 'Concluído'],
  ];
  const index = steps.findIndex(([key]) => key === current);
  const cells = steps
    .map(([, label], position) => {
      const done = index >= 0 && position <= index;
      const background = done ? BRAND.yellow : '#ececec';
      const color = done ? BRAND.ink : '#a5a5a5';
      return `<td align="center" width="20%" style="padding:0 3px;">
        <div style="height:6px;border-radius:3px;background:${background};"></div>
        <div style="margin-top:8px;font:800 9px/1.3 Arial,Helvetica,sans-serif;letter-spacing:.6px;text-transform:uppercase;color:${color};">${escapeHtml(label)}</div>
      </td>`;
    })
    .join('');
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:24px 0 4px;"><tr>${cells}</tr></table>`;
}

type LayoutInput = {
  subject: string;
  preheader: string;
  eyebrow: string;
  title: string;
  body: string;
  accent?: string;
};

export function renderEmail({ subject, preheader, eyebrow, title, body, accent = BRAND.yellow }: LayoutInput) {
  const site = getSiteUrl();
  const whatsapp = getStoreWhatsApp();
  const logo = `${site}/logo.pnh.png`;

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<meta name="color-scheme" content="light" />
<title>${escapeHtml(subject)}</title>
</head>
<body style="margin:0;padding:0;background:${BRAND.canvas};">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapeHtml(preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${BRAND.canvas};padding:0 0 36px;">
  <tr><td align="center" style="background:${BRAND.ink};padding:11px 16px;">
    <span style="font:800 9px/1 Arial,Helvetica,sans-serif;letter-spacing:3px;color:#ffffff;">QUALIDADE</span>
    <span style="color:${BRAND.yellow};margin:0 8px;font-size:9px;">&bull;</span>
    <span style="font:800 9px/1 Arial,Helvetica,sans-serif;letter-spacing:3px;color:#ffffff;">VARIEDADE</span>
    <span style="color:${BRAND.yellow};margin:0 8px;font-size:9px;">&bull;</span>
    <span style="font:800 9px/1 Arial,Helvetica,sans-serif;letter-spacing:3px;color:#ffffff;">CONFIANÇA</span>
  </td></tr>
  <tr><td align="center" style="padding:0 12px;">
    <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:600px;background:${BRAND.paper};border:1px solid ${BRAND.line};border-radius:0 0 16px 16px;overflow:hidden;">
      <tr><td style="padding:22px 30px;border-bottom:1px solid ${BRAND.line};">
        <a href="${escapeHtml(site)}" style="text-decoration:none;">
          <img src="${escapeHtml(logo)}" alt="2P Box" width="104" style="display:block;border:0;width:104px;height:auto;" />
        </a>
      </td></tr>
      <tr><td style="height:4px;background:${accent};font-size:0;line-height:0;">&nbsp;</td></tr>
      <tr><td style="padding:34px 30px 30px;">
        <p style="margin:0 0 12px;font:900 10px/1 Arial,Helvetica,sans-serif;letter-spacing:3.4px;text-transform:uppercase;color:${BRAND.gold};">${escapeHtml(eyebrow)}</p>
        <h1 style="margin:0 0 18px;font:900 34px/1.02 Arial,Helvetica,sans-serif;letter-spacing:-1px;text-transform:uppercase;color:${BRAND.ink};">${escapeHtml(title)}</h1>
        ${body}
      </td></tr>
      <tr><td style="padding:22px 30px;background:${BRAND.ink};">
        <p style="margin:0 0 8px;font:900 9px/1 Arial,Helvetica,sans-serif;letter-spacing:2.6px;color:${BRAND.yellow};">2P BOX</p>
        <p style="margin:0 0 12px;font:400 12px/1.7 Arial,Helvetica,sans-serif;color:#aaaaaa;">
          Tudo que você precisa, em um só lugar.<br />
          Papelaria, eletrônicos, acessórios para celular e Xerox.
        </p>
        ${whatsapp ? `<p style="margin:0 0 12px;font:700 12px/1.6 Arial,Helvetica,sans-serif;color:#dddddd;">WhatsApp: <a href="https://wa.me/${escapeHtml(whatsapp)}" style="color:${BRAND.yellow};text-decoration:none;">${escapeHtml(whatsapp)}</a></p>` : ''}
        <p style="margin:0;font:400 10px/1.6 Arial,Helvetica,sans-serif;color:#777777;">
          <a href="${escapeHtml(site)}/loja" style="color:#aaaaaa;text-decoration:none;">Loja</a>
          &nbsp;&bull;&nbsp;
          <a href="${escapeHtml(site)}/acompanhar-pedido" style="color:#aaaaaa;text-decoration:none;">Acompanhar pedido</a>
          &nbsp;&bull;&nbsp;
          <a href="${escapeHtml(site)}/conta" style="color:#aaaaaa;text-decoration:none;">Minha conta</a>
        </p>
      </td></tr>
      <tr><td style="padding:14px 30px;background:#0b0b0b;">
        <p style="margin:0;font:400 9px/1.6 Arial,Helvetica,sans-serif;color:#666666;">
          Este é um e-mail automático da 2P Box. Não responda esta mensagem.
        </p>
      </td></tr>
    </table>
  </td></tr>
</table>
</body>
</html>`;
}

export function paragraph(text: string) {
  return `<p style="margin:0 0 16px;font:400 15px/1.65 Arial,Helvetica,sans-serif;color:#4d4d4d;">${text}</p>`;
}

export function note(text: string, tone: 'info' | 'warn' | 'danger' | 'success' = 'info') {
  const palette = {
    info: { background: '#f6f6f3', border: BRAND.line, color: '#555555' },
    warn: { background: '#fff9d9', border: '#f0d65b', color: '#5c5000' },
    danger: { background: '#fff2f2', border: '#f0cccc', color: '#8f2626' },
    success: { background: '#effaf1', border: '#bfe6c8', color: '#276b36' },
  }[tone];
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 18px;">
    <tr><td style="padding:14px 16px;background:${palette.background};border:1px solid ${palette.border};border-radius:10px;font:400 13px/1.6 Arial,Helvetica,sans-serif;color:${palette.color};">${text}</td></tr>
  </table>`;
}
