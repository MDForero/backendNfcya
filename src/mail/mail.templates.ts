export interface MailContent {
  subject: string;
  text: string;
  html: string;
}

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

function layout(
  name: string,
  paragraphs: string[],
  action?: { label: string; url: string },
) {
  const text = [
    `Hola ${name},`,
    '',
    ...paragraphs,
    ...(action ? ['', `${action.label}: ${action.url}`] : []),
    '',
    'Equipo nfcYA',
  ].join('\n');

  const html = [
    `<p>Hola ${escapeHtml(name)},</p>`,
    ...paragraphs.map((p) => `<p>${escapeHtml(p)}</p>`),
    action
      ? `<p><a href="${escapeHtml(action.url)}">${escapeHtml(action.label)}</a></p>`
      : '',
    '<p>Equipo nfcYA</p>',
  ].join('\n');

  return { text, html };
}

export function verifyEmailTemplate(name: string, url: string): MailContent {
  return {
    subject: 'Confirma tu correo en nfcYA',
    ...layout(
      name,
      [
        'Confirma tu correo para activar tu cuenta. El enlace vence en 24 horas.',
      ],
      { label: 'Confirmar correo', url },
    ),
  };
}

export function resetPasswordTemplate(name: string, url: string): MailContent {
  return {
    subject: 'Restablece tu contraseña de nfcYA',
    ...layout(
      name,
      [
        'Recibimos una solicitud para restablecer tu contraseña. El enlace vence en 1 hora.',
        'Si no fuiste tú, ignora este correo: tu contraseña no cambiará.',
      ],
      { label: 'Restablecer contraseña', url },
    ),
  };
}

export function registrationAttemptTemplate(
  name: string,
  loginUrl: string,
  resetUrl: string,
): MailContent {
  return {
    subject: 'Intento de registro con tu correo en nfcYA',
    ...layout(name, [
      'Alguien intentó crear una cuenta nueva en nfcYA con este correo, pero ya tienes una.',
      `Si fuiste tú, inicia sesión en ${loginUrl}. Si olvidaste tu contraseña, puedes recuperarla en ${resetUrl}.`,
      'Si no fuiste tú, no necesitas hacer nada.',
    ]),
  };
}

export function providerLinkedTemplate(
  name: string,
  provider: string,
): MailContent {
  return {
    subject: `Vinculaste ${provider} a tu cuenta de nfcYA`,
    ...layout(name, [
      `A partir de ahora puedes iniciar sesión en nfcYA con ${provider}.`,
      'Si no fuiste tú, restablece tu contraseña y contacta a soporte.',
    ]),
  };
}

export function adminInvitationTemplate(
  name: string,
  roleLabel: string,
  url: string,
): MailContent {
  return {
    subject: 'Te invitaron a administrar nfcYA',
    ...layout(
      name,
      [
        `Un administrador de nfcYA creó tu cuenta con el rol ${roleLabel}.`,
        'Para activarla, define tu contraseña con el siguiente enlace. Vence en 72 horas; si vence, pide al administrador que te envíe uno nuevo o usa "¿Olvidaste tu contraseña?".',
        'Si no esperabas esta invitación, ignora este correo.',
      ],
      { label: 'Definir mi contraseña', url },
    ),
  };
}
