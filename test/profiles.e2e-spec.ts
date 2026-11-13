import { AuditAction, AuditLog } from '../src/audit/audit-log.entity';
import { Lead } from '../src/leads/lead.entity';
import { Profile } from '../src/profiles/entities/profile.entity';
import { ProfileStatus } from '../src/profiles/profile.enums';
import { Role, UserStatus } from '../src/users/role.enum';
import { User } from '../src/users/user.entity';
import {
  createOrganization,
  createTestApp,
  LoggedIn,
  resetDb,
  TestContext,
  userSession,
} from './utils';

const MISSING_ID = '00000000-0000-4000-8000-000000000000';

type Session = LoggedIn & { user: User };

describe('Perfiles digitales, enlaces, NFC/QR, vCard y leads (e2e)', () => {
  let ctx: TestContext;

  beforeAll(async () => {
    ctx = await createTestApp();
  });
  beforeEach(() => resetDb(ctx));
  afterAll(() => ctx.app.close());

  const profiles = () => ctx.db.getRepository(Profile);

  async function createProfile(session: Session, data: object = {}) {
    const res = await ctx
      .http()
      .post('/profiles')
      .set(session.auth)
      .send({
        slug: `perfil-${session.user.id.slice(0, 8)}`,
        displayName: 'Ana Gómez',
        ...data,
      })
      .expect(201);
    return res.body as { id: string; slug: string; [key: string]: unknown };
  }

  async function publishedProfile(data: object = {}, seed = {}) {
    const session = await userSession(ctx, seed);
    const profile = await createProfile(session, data);
    await ctx.http().post('/profiles/me/publish').set(session.auth).expect(200);
    return { session, profile };
  }

  async function addLink(session: Session, data: object = {}) {
    const res = await ctx
      .http()
      .post('/profiles/me/links')
      .set(session.auth)
      .send({
        label: 'Web',
        url: 'https://example.com',
        type: 'WEBSITE',
        ...data,
      })
      .expect(201);
    return res.body as { id: string; sortOrder: number };
  }

  describe('Perfil propio', () => {
    it('sin sesión responde 401 y no crea registros', async () => {
      await ctx
        .http()
        .post('/profiles')
        .send({ slug: 'ana', displayName: 'Ana' })
        .expect(401);
      expect(await profiles().count()).toBe(0);
    });

    it('CLIENTE crea un borrador con slug normalizado asociado a su cuenta', async () => {
      const session = await userSession(ctx);
      const res = await ctx
        .http()
        .post('/profiles')
        .set(session.auth)
        .send({
          slug: '  Ana Gómez ',
          displayName: 'Ana Gómez',
          ownerUserId: MISSING_ID,
          status: 'PUBLISHED',
        })
        .expect(201);

      expect(res.body).toMatchObject({
        slug: 'ana-gomez',
        displayName: 'Ana Gómez',
        status: ProfileStatus.DRAFT,
        publicUrl: 'http://localhost:3000/p/ana-gomez',
        showEmail: false,
        showPhone: false,
        links: [],
      });
      const stored = await profiles().findOneByOrFail({ slug: 'ana-gomez' });
      expect(stored.ownerUserId).toBe(session.user.id);
      expect(stored.status).toBe(ProfileStatus.DRAFT);
    });

    it('EMPRESA también puede tener perfil; SOPORTE y SUPER_ADMIN no', async () => {
      const org = await createOrganization(ctx);
      const company = await userSession(ctx, {
        role: Role.EMPRESA,
        organizationId: org.id,
      });
      await createProfile(company);

      for (const role of [Role.SOPORTE, Role.SUPER_ADMIN]) {
        const session = await userSession(ctx, { role });
        await ctx
          .http()
          .post('/profiles')
          .set(session.auth)
          .send({ slug: `rol-${role.toLowerCase()}`, displayName: 'X' })
          .expect(403);
      }
    });

    it('un usuario solo puede tener un perfil', async () => {
      const session = await userSession(ctx);
      await createProfile(session);
      await ctx
        .http()
        .post('/profiles')
        .set(session.auth)
        .send({ slug: 'otro-slug', displayName: 'Ana' })
        .expect(409);
    });

    it('slug duplicado responde 409 y conserva el perfil existente', async () => {
      const ana = await userSession(ctx);
      await createProfile(ana, { slug: 'ana', displayName: 'Ana' });
      const luis = await userSession(ctx);

      await ctx
        .http()
        .post('/profiles')
        .set(luis.auth)
        .send({ slug: 'ANA', displayName: 'Luis' })
        .expect(409);

      await createProfile(luis, { slug: 'luis' });
      await ctx
        .http()
        .patch('/profiles/me')
        .set(luis.auth)
        .send({ slug: 'Ána' })
        .expect(409);

      const anaProfile = await profiles().findOneByOrFail({ slug: 'ana' });
      expect(anaProfile.ownerUserId).toBe(ana.user.id);
      expect(
        (await profiles().findOneByOrFail({ ownerUserId: luis.user.id })).slug,
      ).toBe('luis');
    });

    it.each<[Record<string, unknown>, string]>([
      [{ slug: 'admin' }, 'slug reservado'],
      [{ slug: 'ab' }, 'slug corto'],
      [{ displayName: '' }, 'nombre vacío'],
      [{ avatarUrl: 'http://example.com/a.png' }, 'avatar sin https'],
      [{ website: 'javascript:alert(1)' }, 'web con esquema peligroso'],
      [{ email: 'no-es-email' }, 'email inválido'],
      [{ phone: 'abc' }, 'teléfono inválido'],
      [{ theme: 'NEON' }, 'tema no permitido'],
      [{ bio: 'x'.repeat(1001) }, 'biografía demasiado larga'],
    ])('rechaza datos inválidos: %j (%s)', async (data) => {
      const session = await userSession(ctx);
      await ctx
        .http()
        .post('/profiles')
        .set(session.auth)
        .send({ slug: 'valido', displayName: 'Ana', ...data })
        .expect(400);
      expect(await profiles().count()).toBe(0);
    });

    it('GET /profiles/me responde 404 si aún no hay perfil', async () => {
      const session = await userSession(ctx);
      await ctx.http().get('/profiles/me').set(session.auth).expect(404);
    });

    it('PATCH actualiza solo los campos enviados; "" borra; estado y dueño no se pueden tocar', async () => {
      const session = await userSession(ctx);
      await createProfile(session, {
        headline: 'CEO',
        bio: 'Hola',
        phone: '+57 300 1234567',
      });

      const res = await ctx
        .http()
        .patch('/profiles/me')
        .set(session.auth)
        .send({
          bio: '',
          theme: 'DARK',
          status: 'PUBLISHED',
          ownerUserId: MISSING_ID,
          publishedAt: '2020-01-01',
        })
        .expect(200);

      expect(res.body).toMatchObject({
        headline: 'CEO',
        phone: '+57 300 1234567',
        bio: null,
        theme: 'DARK',
        status: ProfileStatus.DRAFT,
        publishedAt: null,
      });
      expect(
        (await profiles().findOneByOrFail({ ownerUserId: session.user.id }))
          .ownerUserId,
      ).toBe(session.user.id);
    });

    it('disponibilidad de slug: libre, propio, ocupado, reservado e inválido', async () => {
      const ana = await userSession(ctx);
      await createProfile(ana, { slug: 'ana' });
      const luis = await userSession(ctx);

      const check = async (session: Session, slug: string) =>
        (
          await ctx
            .http()
            .get('/profiles/slug-availability')
            .query({ slug })
            .set(session.auth)
            .expect(200)
        ).body as { slug: string; available: boolean; reason: string | null };

      expect(await check(luis, 'Luis Pérez')).toEqual({
        slug: 'luis-perez',
        available: true,
        reason: null,
      });
      expect(await check(ana, 'ana')).toMatchObject({ available: true });
      expect(await check(luis, 'ANA')).toMatchObject({
        slug: 'ana',
        available: false,
      });
      expect(await check(luis, 'login')).toMatchObject({
        available: false,
        reason: 'Ese slug está reservado',
      });
      expect(await check(luis, '!!')).toMatchObject({ available: false });
    });
  });

  describe('Publicación y perfil público', () => {
    it('un borrador no es público; al publicar se ve solo la lista permitida de campos', async () => {
      const session = await userSession(ctx);
      await createProfile(session, {
        slug: 'ana',
        headline: 'Diseñadora',
        email: 'ana@privado.com',
        phone: '+57 300 1234567',
      });

      await ctx.http().get('/profiles/public/ana').expect(404);

      const published = await ctx
        .http()
        .post('/profiles/me/publish')
        .set(session.auth)
        .expect(200);
      expect(published.body).toMatchObject({
        status: ProfileStatus.PUBLISHED,
        publishedAt: expect.any(String),
      });

      const res = await ctx.http().get('/profiles/public/ANA').expect(200);
      expect(Object.keys(res.body).sort()).toEqual(
        [
          'avatarUrl',
          'bio',
          'coverUrl',
          'displayName',
          'email',
          'headline',
          'leadsEnabled',
          'links',
          'locationLabel',
          'phone',
          'slug',
          'theme',
          'website',
        ].sort(),
      );
      expect(res.body).toMatchObject({
        slug: 'ana',
        headline: 'Diseñadora',
        email: null,
        phone: null,
      });
      expect(JSON.stringify(res.body)).not.toContain(session.user.id);
    });

    it('email y teléfono solo aparecen si el propietario los autoriza', async () => {
      const { session } = await publishedProfile({
        slug: 'ana',
        email: 'ana@example.com',
        phone: '+57 300 1234567',
      });
      await ctx
        .http()
        .patch('/profiles/me')
        .set(session.auth)
        .send({ showEmail: true })
        .expect(200);
      const res = await ctx.http().get('/profiles/public/ana').expect(200);
      expect(res.body).toMatchObject({ email: 'ana@example.com', phone: null });
    });

    it('despublicar oculta el perfil', async () => {
      const { session } = await publishedProfile({ slug: 'ana' });
      await ctx.http().get('/profiles/public/ana').expect(200);
      await ctx
        .http()
        .post('/profiles/me/unpublish')
        .set(session.auth)
        .expect(200);
      await ctx.http().get('/profiles/public/ana').expect(404);
    });

    it('si la cuenta del propietario está suspendida el perfil no es público', async () => {
      const { session } = await publishedProfile({ slug: 'ana' });
      await ctx.db
        .getRepository(User)
        .update(session.user.id, { status: UserStatus.SUSPENDIDA });
      await ctx.http().get('/profiles/public/ana').expect(404);
    });

    it('slug inexistente responde 404 con mensaje genérico', async () => {
      const res = await ctx
        .http()
        .get('/profiles/public/no-existe')
        .expect(404);
      expect(res.body.message).toBe('Perfil no encontrado');
    });
  });

  describe('Enlaces', () => {
    it('crea, edita, desactiva y elimina enlaces propios', async () => {
      const { session } = await publishedProfile({ slug: 'ana' });
      const web = await addLink(session, { label: 'Web' });
      const insta = await addLink(session, {
        label: 'Instagram',
        url: 'https://instagram.com/ana',
        type: 'INSTAGRAM',
      });
      expect([web.sortOrder, insta.sortOrder]).toEqual([0, 1]);

      await ctx
        .http()
        .patch(`/profiles/me/links/${web.id}`)
        .set(session.auth)
        .send({ label: 'Mi web', isActive: false })
        .expect(200)
        .expect((res) =>
          expect(res.body).toMatchObject({
            label: 'Mi web',
            isActive: false,
            url: 'https://example.com',
          }),
        );

      let pub = await ctx.http().get('/profiles/public/ana').expect(200);
      expect(pub.body.links).toEqual([
        {
          label: 'Instagram',
          url: 'https://instagram.com/ana',
          type: 'INSTAGRAM',
        },
      ]);

      await ctx
        .http()
        .delete(`/profiles/me/links/${insta.id}`)
        .set(session.auth)
        .expect(204);
      pub = await ctx.http().get('/profiles/public/ana').expect(200);
      expect(pub.body.links).toEqual([]);

      const own = await ctx
        .http()
        .get('/profiles/me/links')
        .set(session.auth)
        .expect(200);
      expect(own.body).toHaveLength(1);
    });

    it.each([
      'javascript:alert(1)',
      'data:text/html,<script>alert(1)</script>',
      'vbscript:msgbox(1)',
      'file:///etc/passwd',
      'no-es-url',
    ])('rechaza la URL %s', async (url) => {
      const session = await userSession(ctx);
      await createProfile(session);
      await ctx
        .http()
        .post('/profiles/me/links')
        .set(session.auth)
        .send({ label: 'X', url })
        .expect(400);
    });

    it('acepta mailto:, tel: y WhatsApp', async () => {
      const session = await userSession(ctx);
      await createProfile(session);
      for (const url of [
        'mailto:ana@example.com',
        'tel:+573001234567',
        'https://wa.me/573001234567',
      ])
        await addLink(session, { url, type: 'OTHER' });
    });

    it('limita el número de enlaces por perfil', async () => {
      const session = await userSession(ctx);
      await createProfile(session);
      for (let i = 0; i < 20; i++) await addLink(session, { label: `L${i}` });
      await ctx
        .http()
        .post('/profiles/me/links')
        .set(session.auth)
        .send({ label: 'Uno más', url: 'https://example.com' })
        .expect(409);
    });

    it('reordena en bloque y el perfil público respeta el orden', async () => {
      const { session } = await publishedProfile({ slug: 'ana' });
      const a = await addLink(session, { label: 'A' });
      const b = await addLink(session, { label: 'B' });
      const c = await addLink(session, { label: 'C' });

      const res = await ctx
        .http()
        .patch('/profiles/me/links/reorder')
        .set(session.auth)
        .send({ ids: [c.id, a.id, b.id] })
        .expect(200);
      expect((res.body as { label: string }[]).map((l) => l.label)).toEqual([
        'C',
        'A',
        'B',
      ]);

      const pub = await ctx.http().get('/profiles/public/ana').expect(200);
      expect(
        (pub.body.links as { label: string }[]).map((l) => l.label),
      ).toEqual(['C', 'A', 'B']);
    });

    it('reordenar exige exactamente los IDs del perfil (ni faltantes ni ajenos)', async () => {
      const ana = await userSession(ctx);
      await createProfile(ana);
      const a = await addLink(ana, { label: 'A' });
      const b = await addLink(ana, { label: 'B' });
      const luis = await userSession(ctx);
      await createProfile(luis);
      const foreign = await addLink(luis);

      for (const ids of [
        [a.id],
        [a.id, foreign.id],
        [a.id, b.id, foreign.id],
        [a.id, a.id],
      ])
        await ctx
          .http()
          .patch('/profiles/me/links/reorder')
          .set(ana.auth)
          .send({ ids })
          .expect(400);
    });

    it('no se pueden modificar ni eliminar enlaces de otro usuario', async () => {
      const ana = await userSession(ctx);
      await createProfile(ana);
      const link = await addLink(ana, { label: 'De Ana' });
      const luis = await userSession(ctx);
      await createProfile(luis);

      await ctx
        .http()
        .patch(`/profiles/me/links/${link.id}`)
        .set(luis.auth)
        .send({ label: 'Hackeado' })
        .expect(404);
      await ctx
        .http()
        .delete(`/profiles/me/links/${link.id}`)
        .set(luis.auth)
        .expect(404);

      const own = await ctx
        .http()
        .get('/profiles/me/links')
        .set(ana.auth)
        .expect(200);
      expect(own.body).toMatchObject([{ id: link.id, label: 'De Ana' }]);
    });

    it('sin perfil propio las rutas de enlaces responden 404', async () => {
      const session = await userSession(ctx);
      await ctx.http().get('/profiles/me/links').set(session.auth).expect(404);
    });
  });

  describe('NFC y QR', () => {
    async function createIdentifier(session: Session, kind = 'NFC') {
      const res = await ctx
        .http()
        .post('/profiles/me/identifiers')
        .set(session.auth)
        .send({ kind, label: 'Tarjeta' })
        .expect(201);
      return res.body as {
        id: string;
        code: string;
        url: string;
        status: string;
      };
    }

    it('crea códigos opacos y únicos con URL de resolución', async () => {
      const { session } = await publishedProfile({ slug: 'ana' });
      const nfc = await createIdentifier(session, 'NFC');
      const qr = await createIdentifier(session, 'QR');

      expect(nfc.code).toMatch(/^[A-Za-z0-9_-]{16}$/);
      expect(nfc.code).not.toBe(qr.code);
      expect(nfc.url).toBe(`http://localhost:3000/r/${nfc.code}`);
      expect(nfc.status).toBe('ACTIVE');

      const list = await ctx
        .http()
        .get('/profiles/me/identifiers')
        .set(session.auth)
        .expect(200);
      expect(list.body).toHaveLength(2);
    });

    it('un código activo de un perfil publicado resuelve a su slug', async () => {
      const { session } = await publishedProfile({ slug: 'ana' });
      const nfc = await createIdentifier(session);
      const res = await ctx.http().get(`/resolve/${nfc.code}`).expect(200);
      expect(res.body).toEqual({ slug: 'ana', kind: 'NFC' });
    });

    it('no resuelve si el perfil no está publicado', async () => {
      const session = await userSession(ctx);
      await createProfile(session);
      const nfc = await createIdentifier(session);
      await ctx.http().get(`/resolve/${nfc.code}`).expect(404);
    });

    it('desactivar detiene la resolución y reactivar la restablece', async () => {
      const { session } = await publishedProfile({ slug: 'ana' });
      const nfc = await createIdentifier(session);
      const setStatus = (status: string) =>
        ctx
          .http()
          .patch(`/profiles/me/identifiers/${nfc.id}/status`)
          .set(session.auth)
          .send({ status });

      await setStatus('INACTIVE').expect(200);
      await ctx.http().get(`/resolve/${nfc.code}`).expect(404);
      await setStatus('ACTIVE').expect(200);
      await ctx.http().get(`/resolve/${nfc.code}`).expect(200);
    });

    it('revocar es definitivo', async () => {
      const { session } = await publishedProfile({ slug: 'ana' });
      const nfc = await createIdentifier(session);
      const setStatus = (status: string) =>
        ctx
          .http()
          .patch(`/profiles/me/identifiers/${nfc.id}/status`)
          .set(session.auth)
          .send({ status });

      const revoked = await setStatus('REVOKED').expect(200);
      expect(revoked.body).toMatchObject({
        status: 'REVOKED',
        revokedAt: expect.any(String),
      });
      const res = await ctx.http().get(`/resolve/${nfc.code}`).expect(404);
      expect(res.body.message).toBe('Código no disponible');
      await setStatus('ACTIVE').expect(409);
    });

    it('códigos inexistentes o mal formados responden igual', async () => {
      for (const code of [
        'AAAAAAAAAAAAAAAA',
        'corto',
        '../../etc',
        "1' OR '1'='1",
      ]) {
        const res = await ctx
          .http()
          .get(`/resolve/${encodeURIComponent(code)}`)
          .expect(404);
        expect(res.body.message).toBe('Código no disponible');
      }
    });

    it('otro usuario no puede cambiar el estado de un código ajeno', async () => {
      const { session: ana } = await publishedProfile({ slug: 'ana' });
      const nfc = await createIdentifier(ana);
      const luis = await userSession(ctx);
      await createProfile(luis);

      await ctx
        .http()
        .patch(`/profiles/me/identifiers/${nfc.id}/status`)
        .set(luis.auth)
        .send({ status: 'REVOKED' })
        .expect(404);
      await ctx.http().get(`/resolve/${nfc.code}`).expect(200);
    });

    it('rechaza tipos y estados inválidos', async () => {
      const session = await userSession(ctx);
      await createProfile(session);
      await ctx
        .http()
        .post('/profiles/me/identifiers')
        .set(session.auth)
        .send({ kind: 'BLE' })
        .expect(400);
      const nfc = await createIdentifier(session);
      await ctx
        .http()
        .patch(`/profiles/me/identifiers/${nfc.id}/status`)
        .set(session.auth)
        .send({ status: 'BORRADO' })
        .expect(400);
    });
  });

  describe('vCard', () => {
    it('descarga un .vcf con los campos públicos', async () => {
      await publishedProfile({
        slug: 'jose',
        displayName: 'José Pérez',
        headline: 'CEO; Fundador',
        email: 'jose@privado.com',
        phone: '+57 300 1234567',
        showPhone: true,
      });

      const res = await ctx
        .http()
        .get('/profiles/public/jose/vcard')
        .expect(200);
      expect(res.headers['content-type']).toBe('text/vcard; charset=utf-8');
      expect(res.headers['content-disposition']).toBe(
        'attachment; filename="jose.vcf"',
      );
      const card = res.text;
      expect(card).toContain('FN:José Pérez\r\n');
      expect(card).toContain('TITLE:CEO\\; Fundador\r\n');
      expect(card).toContain('TEL;TYPE=CELL:+57 300 1234567\r\n');
      expect(card).toContain('URL:http://localhost:3000/p/jose\r\n');
      expect(card).not.toContain('jose@privado.com');
    });

    it('no existe para perfiles no publicados', async () => {
      const session = await userSession(ctx);
      await createProfile(session, { slug: 'borrador' });
      await ctx.http().get('/profiles/public/borrador/vcard').expect(404);
    });
  });

  describe('Leads', () => {
    const leads = () => ctx.db.getRepository(Lead);
    const validLead = {
      name: 'Visitante',
      email: 'v@example.com',
      consentAccepted: true,
    };

    it('sin captura activada responde 404', async () => {
      await publishedProfile({ slug: 'ana' });
      await ctx
        .http()
        .post('/profiles/public/ana/leads')
        .send(validLead)
        .expect(404);
      expect(await leads().count()).toBe(0);
    });

    it.each<[Record<string, unknown>, string]>([
      [{ ...validLead, consentAccepted: false }, 'sin consentimiento'],
      [{ ...validLead, consentAccepted: 'true' }, 'consentimiento no booleano'],
      [{ name: 'X', consentAccepted: true }, 'sin email ni teléfono'],
      [{ ...validLead, email: 'malo' }, 'email inválido'],
      [{ ...validLead, name: '' }, 'sin nombre'],
    ])('no guarda nada si el formulario es inválido: %j (%s)', async (body) => {
      await publishedProfile({ slug: 'ana', leadsEnabled: true });
      await ctx
        .http()
        .post('/profiles/public/ana/leads')
        .send(body)
        .expect(400);
      expect(await leads().count()).toBe(0);
    });

    it('guarda el lead con fuente y fecha; solo el propietario lo consulta y elimina', async () => {
      const { session: ana } = await publishedProfile({
        slug: 'ana',
        leadsEnabled: true,
      });
      await ctx
        .http()
        .post('/profiles/public/ana/leads')
        .send({
          name: 'Visitante',
          phone: '+57 300 1234567',
          consentAccepted: true,
          source: 'NFC',
        })
        .expect(201)
        .expect({ received: true });

      const stored = await leads().findOneByOrFail({ name: 'Visitante' });
      expect(stored).toMatchObject({
        source: 'NFC',
        consentAccepted: true,
        email: null,
      });
      expect(stored.createdAt).toBeInstanceOf(Date);

      const own = await ctx
        .http()
        .get('/profiles/me/leads')
        .set(ana.auth)
        .expect(200);
      expect(own.body).toMatchObject({
        total: 1,
        items: [{ name: 'Visitante', source: 'NFC' }],
      });

      const luis = await userSession(ctx);
      await createProfile(luis);
      const other = await ctx
        .http()
        .get('/profiles/me/leads')
        .set(luis.auth)
        .expect(200);
      expect(other.body.total).toBe(0);
      await ctx
        .http()
        .delete(`/profiles/me/leads/${stored.id}`)
        .set(luis.auth)
        .expect(404);

      await ctx
        .http()
        .delete(`/profiles/me/leads/${stored.id}`)
        .set(ana.auth)
        .expect(204);
      expect(await leads().count()).toBe(0);
    });

    it('solo SUPER_ADMIN (además del propietario) consulta leads desde administración', async () => {
      const { profile } = await publishedProfile({
        slug: 'ana',
        leadsEnabled: true,
      });
      await ctx
        .http()
        .post('/profiles/public/ana/leads')
        .send(validLead)
        .expect(201);

      const admin = await userSession(ctx, { role: Role.SUPER_ADMIN });
      const res = await ctx
        .http()
        .get(`/admin/profiles/${profile.id}/leads`)
        .set(admin.auth)
        .expect(200);
      expect(res.body.total).toBe(1);

      for (const role of [Role.SOPORTE, Role.CLIENTE]) {
        const session = await userSession(ctx, { role });
        await ctx
          .http()
          .get(`/admin/profiles/${profile.id}/leads`)
          .set(session.auth)
          .expect(403);
      }
    });
  });

  describe('Administración de perfiles', () => {
    it('CLIENTE no accede a /admin/profiles', async () => {
      const session = await userSession(ctx);
      await ctx.http().get('/admin/profiles').set(session.auth).expect(403);
    });

    it('SUPER_ADMIN y SOPORTE listan con filtros, búsqueda y paginación', async () => {
      await publishedProfile({ slug: 'ana', displayName: 'Ana' });
      const luis = await userSession(ctx, { email: 'luis@example.com' });
      await createProfile(luis, { slug: 'luis', displayName: 'Luis' });

      for (const role of [Role.SUPER_ADMIN, Role.SOPORTE]) {
        const session = await userSession(ctx, { role });
        const all = await ctx
          .http()
          .get('/admin/profiles?pageSize=1')
          .set(session.auth)
          .expect(200);
        expect(all.body).toMatchObject({ total: 2, page: 1, pageSize: 1 });
        expect(all.body.items).toHaveLength(1);

        const drafts = await ctx
          .http()
          .get('/admin/profiles?status=DRAFT')
          .set(session.auth)
          .expect(200);
        expect(drafts.body.items.map((p: { slug: string }) => p.slug)).toEqual([
          'luis',
        ]);

        const byEmail = await ctx
          .http()
          .get('/admin/profiles?search=luis@')
          .set(session.auth)
          .expect(200);
        expect(byEmail.body.items).toMatchObject([
          { slug: 'luis', owner: { email: 'luis@example.com' } },
        ]);
      }
    });

    it('EMPRESA solo ve y gestiona perfiles de clientes de su organización', async () => {
      const orgA = await createOrganization(ctx);
      const orgB = await createOrganization(ctx);
      const company = await userSession(ctx, {
        role: Role.EMPRESA,
        organizationId: orgA.id,
      });
      const { profile: mine } = await publishedProfile(
        { slug: 'cliente-a' },
        { organizationId: orgA.id },
      );
      const { profile: theirs } = await publishedProfile(
        { slug: 'cliente-b' },
        { organizationId: orgB.id },
      );

      const list = await ctx
        .http()
        .get('/admin/profiles')
        .set(company.auth)
        .expect(200);
      expect(list.body.items.map((p: { slug: string }) => p.slug)).toEqual([
        'cliente-a',
      ]);

      await ctx
        .http()
        .get(`/admin/profiles/${theirs.id}`)
        .set(company.auth)
        .expect(404);
      await ctx
        .http()
        .post(`/admin/profiles/${theirs.id}/suspend`)
        .set(company.auth)
        .expect(404);
      await ctx
        .http()
        .post(`/admin/profiles/${mine.id}/suspend`)
        .set(company.auth)
        .expect(200);
      await ctx.http().get('/profiles/public/cliente-b').expect(200);
    });

    it('SOPORTE no puede suspender', async () => {
      const { profile } = await publishedProfile({ slug: 'ana' });
      const support = await userSession(ctx, { role: Role.SOPORTE });
      await ctx
        .http()
        .post(`/admin/profiles/${profile.id}/suspend`)
        .set(support.auth)
        .expect(403);
    });

    it('suspender oculta el perfil, bloquea publicar y queda auditado; reactivar lo deja en borrador', async () => {
      const { session: owner, profile } = await publishedProfile({
        slug: 'ana',
      });
      const nfc = await ctx
        .http()
        .post('/profiles/me/identifiers')
        .set(owner.auth)
        .send({ kind: 'QR' })
        .expect(201);
      const admin = await userSession(ctx, { role: Role.SUPER_ADMIN });

      const suspended = await ctx
        .http()
        .post(`/admin/profiles/${profile.id}/suspend`)
        .set(admin.auth)
        .expect(200);
      expect(suspended.body).toMatchObject({
        status: ProfileStatus.SUSPENDED,
        suspendedAt: expect.any(String),
      });
      await ctx
        .http()
        .post(`/admin/profiles/${profile.id}/suspend`)
        .set(admin.auth)
        .expect(409);

      await ctx.http().get('/profiles/public/ana').expect(404);
      await ctx.http().get(`/resolve/${nfc.body.code}`).expect(404);
      await ctx.http().post('/profiles/me/publish').set(owner.auth).expect(403);
      await ctx
        .http()
        .post('/profiles/me/unpublish')
        .set(owner.auth)
        .expect(403);

      const reactivated = await ctx
        .http()
        .post(`/admin/profiles/${profile.id}/reactivate`)
        .set(admin.auth)
        .expect(200);
      expect(reactivated.body).toMatchObject({
        status: ProfileStatus.DRAFT,
        suspendedAt: null,
      });
      await ctx.http().post('/profiles/me/publish').set(owner.auth).expect(200);
      await ctx.http().get('/profiles/public/ana').expect(200);

      const logs = await ctx.db
        .getRepository(AuditLog)
        .find({ order: { createdAt: 'ASC' } });
      expect(logs.map((l) => l.action)).toEqual([
        AuditAction.PROFILE_SUSPENDED,
        AuditAction.PROFILE_REACTIVATED,
      ]);
      expect(logs[0]).toMatchObject({
        actorId: admin.user.id,
        targetUserId: owner.user.id,
        before: { profileId: profile.id, status: 'PUBLISHED' },
        after: { profileId: profile.id, status: 'SUSPENDED' },
      });
      expect(logs[0].createdAt).toBeInstanceOf(Date);
    });

    it('ID inexistente responde 404', async () => {
      const admin = await userSession(ctx, { role: Role.SUPER_ADMIN });
      await ctx
        .http()
        .get(`/admin/profiles/${MISSING_ID}`)
        .set(admin.auth)
        .expect(404);
    });
  });
});
