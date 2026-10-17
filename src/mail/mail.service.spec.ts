import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MailService } from './mail.service';
import { LogMailTransport, MailTransport } from './mail.transport';

const config = {
  get: (key: string) =>
    key === 'FRONTEND_URL' ? 'https://app.nfcya.com/' : undefined,
} as unknown as ConfigService<any, true>;

const to = { email: 'ana@example.com', name: 'Ana <script>' };

describe('MailService', () => {
  let transport: LogMailTransport;
  let mail: MailService;

  beforeAll(() =>
    jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined),
  );
  afterAll(() => jest.restoreAllMocks());

  beforeEach(() => {
    transport = new LogMailTransport();
    mail = new MailService(transport, config);
  });

  it('el transporte log guarda el mensaje sin enviarlo', async () => {
    await mail.sendVerification(to, 'tok');
    expect(transport.outbox).toHaveLength(1);
    expect(transport.outbox[0].to).toBe('ana@example.com');
  });

  it('verificación enlaza a FRONTEND_URL/auth/verify-email con el token', async () => {
    await mail.sendVerification(to, 'abc_123');
    const msg = transport.outbox[0];
    expect(msg.text).toContain(
      'https://app.nfcya.com/auth/verify-email?token=abc_123',
    );
    expect(msg.html).toContain(
      'https://app.nfcya.com/auth/verify-email?token=abc_123',
    );
  });

  it('recuperación enlaza a FRONTEND_URL/auth/reset-password con el token', async () => {
    await mail.sendPasswordReset(to, 'xyz');
    expect(transport.outbox[0].text).toContain(
      'https://app.nfcya.com/auth/reset-password?token=xyz',
    );
  });

  it('el aviso de intento de registro enlaza a login y recuperación, sin token', async () => {
    await mail.sendRegistrationAttempt(to);
    const { text } = transport.outbox[0];
    expect(text).toContain('https://app.nfcya.com/auth/login');
    expect(text).toContain('https://app.nfcya.com/auth/forgot-password');
    expect(text).not.toContain('token=');
  });

  it('el aviso de proveedor vinculado nombra al proveedor', async () => {
    await mail.sendProviderLinked(to, 'Google');
    expect(transport.outbox[0].subject).toContain('Google');
  });

  it('escapa el HTML de los datos del usuario', async () => {
    await mail.sendVerification(to, 'tok');
    expect(transport.outbox[0].html).toContain('Ana &lt;script&gt;');
  });

  it('no propaga errores del transporte', async () => {
    const failing: MailTransport = {
      send: () => Promise.reject(new Error('smtp caído')),
    };
    const service = new MailService(failing, config);
    jest.spyOn(service['logger'], 'error').mockImplementation(() => undefined);
    await expect(service.sendVerification(to, 'tok')).resolves.toBeUndefined();
  });
});
