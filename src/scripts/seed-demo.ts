import { ConsoleLogger } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { hashPassword } from '../auth/crypto.util';
import dataSource from '../database/data-source';
import { Lead, LeadSource } from '../leads/lead.entity';
import { Organization } from '../organizations/organization.entity';
import { ProfileIdentifier } from '../profiles/entities/profile-identifier.entity';
import { ProfileLink } from '../profiles/entities/profile-link.entity';
import { Profile } from '../profiles/entities/profile.entity';
import { generatePublicCode } from '../profiles/profile-identifiers.service';
import {
  IdentifierKind,
  LinkType,
  ProfileStatus,
  ProfileTheme,
} from '../profiles/profile.enums';
import { identifierUrl, profileUrl } from '../profiles/profile.views';
import { Role, UserStatus } from '../users/role.enum';
import { User } from '../users/user.entity';

const logger = new ConsoleLogger('seed:demo');
const ORG_NAME = 'NFCya Demo SAS';
const DOMAIN = 'demo.nfcya.test';

interface DemoProfile {
  slug: string;
  displayName: string;
  headline: string;
  bio: string;
  phone?: string;
  email?: string;
  website?: string;
  locationLabel?: string;
  theme: ProfileTheme;
  publish: boolean;
  leadsEnabled?: boolean;
  links: { label: string; url: string; type: LinkType; isActive?: boolean }[];
  identifiers?: { kind: IdentifierKind; label: string }[];
  sampleLead?: boolean;
}

interface DemoUser {
  email: string;
  name: string;
  role: Role;
  inOrg: boolean;
  profile?: DemoProfile;
}

const USERS: DemoUser[] = [
  {
    email: `ana@${DOMAIN}`,
    name: 'Ana Gómez',
    role: Role.CLIENTE,
    inOrg: true,
    profile: {
      slug: 'ana-gomez-demo',
      displayName: 'Ana Gómez',
      headline: 'Diseñadora de marca · NFCya Demo SAS',
      bio: 'Ayudo a pequeñas empresas a verse profesionales.\nEscríbeme por WhatsApp o déjame tus datos.',
      phone: '+57 300 000 0001',
      email: `ana@${DOMAIN}`,
      website: 'https://example.com',
      locationLabel: 'Bogotá, Colombia',
      theme: ProfileTheme.OCEAN,
      publish: true,
      leadsEnabled: true,
      links: [
        {
          label: 'WhatsApp',
          url: 'https://wa.me/573000000001',
          type: LinkType.WHATSAPP,
        },
        {
          label: 'Portafolio',
          url: 'https://example.com/portafolio',
          type: LinkType.WEBSITE,
        },
        {
          label: 'LinkedIn',
          url: 'https://www.linkedin.com/in/ejemplo',
          type: LinkType.LINKEDIN,
        },
        {
          label: 'Enlace oculto',
          url: 'https://example.com/privado',
          type: LinkType.OTHER,
          isActive: false,
        },
      ],
      identifiers: [
        { kind: IdentifierKind.NFC, label: 'Tarjeta principal' },
        { kind: IdentifierKind.QR, label: 'QR del stand' },
      ],
      sampleLead: true,
    },
  },
  {
    email: `empresa@${DOMAIN}`,
    name: 'NFCya Demo SAS',
    role: Role.EMPRESA,
    inOrg: true,
    profile: {
      slug: 'nfcya-demo-sas',
      displayName: 'NFCya Demo SAS',
      headline: 'Tarjetas digitales para equipos',
      bio: 'Perfil de empresa de demostración.',
      website: 'https://example.com',
      theme: ProfileTheme.DARK,
      publish: true,
      links: [
        {
          label: 'Sitio web',
          url: 'https://example.com',
          type: LinkType.WEBSITE,
        },
      ],
      identifiers: [{ kind: IdentifierKind.QR, label: 'QR recepción' }],
    },
  },
  {
    email: `luis@${DOMAIN}`,
    name: 'Luis Pérez',
    role: Role.CLIENTE,
    inOrg: false,
    profile: {
      slug: 'luis-perez-demo',
      displayName: 'Luis Pérez',
      headline: 'Perfil en borrador (no público)',
      bio: 'Sirve para mostrar que un borrador no es visible.',
      theme: ProfileTheme.DEFAULT,
      publish: false,
      links: [],
    },
  },
  {
    email: `soporte@${DOMAIN}`,
    name: 'Soporte Demo',
    role: Role.SOPORTE,
    inOrg: false,
  },
];

function demoPassword() {
  const password = process.env.DEMO_PASSWORD ?? '';
  if (password.length < 8 || !/[A-Za-z]/.test(password) || !/\d/.test(password))
    throw new Error(
      'Define DEMO_PASSWORD (mín. 8 caracteres, con letras y números) para las cuentas demo',
    );
  return password;
}

async function seedProfile(db: DataSource, owner: User, data: DemoProfile) {
  const profiles = db.getRepository(Profile);
  if (await profiles.existsBy({ ownerUserId: owner.id })) return null;

  const profile = await profiles.save(
    profiles.create({
      ownerUserId: owner.id,
      slug: data.slug,
      displayName: data.displayName,
      headline: data.headline,
      bio: data.bio,
      phone: data.phone ?? null,
      email: data.email ?? null,
      website: data.website ?? null,
      locationLabel: data.locationLabel ?? null,
      showPhone: !!data.phone,
      showEmail: false,
      leadsEnabled: data.leadsEnabled ?? false,
      theme: data.theme,
      status: data.publish ? ProfileStatus.PUBLISHED : ProfileStatus.DRAFT,
      publishedAt: data.publish ? new Date() : null,
    }),
  );

  const links = db.getRepository(ProfileLink);
  await links.save(
    data.links.map((link, index) =>
      links.create({
        ...link,
        isActive: link.isActive ?? true,
        profileId: profile.id,
        sortOrder: index,
      }),
    ),
  );

  const identifiers = db.getRepository(ProfileIdentifier);
  const codes: string[] = [];
  for (const identifier of data.identifiers ?? []) {
    const saved = await identifiers.save(
      identifiers.create({
        ...identifier,
        profileId: profile.id,
        publicCode: generatePublicCode(),
      }),
    );
    codes.push(
      `${identifier.kind} "${identifier.label}": ${identifierUrl(saved.publicCode)}`,
    );
  }

  if (data.sampleLead) {
    const leads = db.getRepository(Lead);
    await leads.save(
      leads.create({
        profileId: profile.id,
        name: 'Visitante de ejemplo',
        email: `visitante@${DOMAIN}`,
        message: 'Hola, me interesa una cotización.',
        consentAccepted: true,
        source: LeadSource.QR,
      }),
    );
  }
  return { profile, codes };
}

/**
 * pnpm seed:demo — datos de demostración (idempotente; nunca en producción).
 * Requiere DEMO_PASSWORD. Las cuentas usan el dominio reservado .test.
 */
async function main() {
  if (process.env.NODE_ENV === 'production')
    throw new Error('seed:demo no se ejecuta con NODE_ENV=production');
  const passwordHash = await hashPassword(demoPassword());

  const db = await dataSource.initialize();
  try {
    const orgs = db.getRepository(Organization);
    const org =
      (await orgs.findOneBy({ name: ORG_NAME })) ??
      (await orgs.save(orgs.create({ name: ORG_NAME })));

    const users = db.getRepository(User);
    for (const demo of USERS) {
      let user = await users.findOneBy({ email: demo.email });
      if (user) {
        logger.log(`${demo.email} ya existe: se conserva`);
      } else {
        user = await users.save(
          users.create({
            email: demo.email,
            name: demo.name,
            role: demo.role,
            status: UserStatus.ACTIVA,
            emailVerifiedAt: new Date(),
            passwordHash,
            organizationId: demo.inOrg ? org.id : null,
          }),
        );
        logger.log(`Creado ${demo.role} ${demo.email}`);
      }

      if (!demo.profile) continue;
      const result = await seedProfile(db, user, demo.profile);
      if (!result) {
        logger.log(`  perfil de ${demo.email} ya existe: se conserva`);
        continue;
      }
      logger.log(
        `  perfil ${result.profile.status}: ${profileUrl(result.profile.slug)}`,
      );
      for (const code of result.codes) logger.log(`  ${code}`);
    }
    logger.log('Listo. El SUPER_ADMIN se crea aparte con pnpm seed:admin.');
  } finally {
    await db.destroy();
  }
}

main().catch((error: Error) => {
  logger.error(error.message);
  process.exit(1);
});
