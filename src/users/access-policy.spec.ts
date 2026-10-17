import {
  canManageStatus,
  canView,
  listScope,
  PolicySubject,
} from './access-policy';
import { Role } from './role.enum';

const ORG_A = 'org-a';
const ORG_B = 'org-b';

const u = (
  id: string,
  role: Role,
  organizationId: string | null = null,
): PolicySubject => ({
  id,
  role,
  organizationId,
});

const superAdmin = u('sa', Role.SUPER_ADMIN);
const soporte = u('sp', Role.SOPORTE);
const empresaA = u('ea', Role.EMPRESA, ORG_A);
const clienteA = u('ca', Role.CLIENTE, ORG_A);
const clienteB = u('cb', Role.CLIENTE, ORG_B);
const clienteSinOrg = u('cx', Role.CLIENTE);
const empresaA2 = u('ea2', Role.EMPRESA, ORG_A);
const otroAdmin = u('sa2', Role.SUPER_ADMIN);

describe('access-policy', () => {
  describe('canView', () => {
    it.each`
      actor         | target           | expected
      ${superAdmin} | ${clienteB}      | ${true}
      ${superAdmin} | ${otroAdmin}     | ${true}
      ${soporte}    | ${clienteA}      | ${true}
      ${soporte}    | ${superAdmin}    | ${true}
      ${empresaA}   | ${clienteA}      | ${true}
      ${empresaA}   | ${clienteB}      | ${false}
      ${empresaA}   | ${clienteSinOrg} | ${false}
      ${empresaA}   | ${empresaA2}     | ${false}
      ${clienteA}   | ${clienteA}      | ${false}
      ${clienteA}   | ${clienteB}      | ${false}
    `(
      '$actor.id ve a $target.id → $expected',
      ({ actor, target, expected }) => {
        expect(canView(actor, target)).toBe(expected);
      },
    );
  });

  describe('canManageStatus', () => {
    it.each`
      actor         | target        | expected
      ${superAdmin} | ${clienteB}   | ${true}
      ${superAdmin} | ${otroAdmin}  | ${true}
      ${superAdmin} | ${superAdmin} | ${false}
      ${soporte}    | ${clienteA}   | ${false}
      ${empresaA}   | ${clienteA}   | ${true}
      ${empresaA}   | ${clienteB}   | ${false}
      ${empresaA}   | ${empresaA2}  | ${false}
      ${empresaA}   | ${empresaA}   | ${false}
      ${clienteA}   | ${clienteA}   | ${false}
    `(
      '$actor.id gestiona a $target.id → $expected',
      ({ actor, target, expected }) => {
        expect(canManageStatus(actor, target)).toBe(expected);
      },
    );
  });

  describe('listScope', () => {
    it('SUPER_ADMIN y SOPORTE listan sin restricción', () => {
      expect(listScope(superAdmin)).toBeNull();
      expect(listScope(soporte)).toBeNull();
    });

    it('EMPRESA queda limitada a los CLIENTE de su organización', () => {
      expect(listScope(empresaA)).toEqual({
        role: Role.CLIENTE,
        organizationId: ORG_A,
      });
    });

    it('CLIENTE no puede listar', () => {
      expect(() => listScope(clienteA)).toThrow();
    });
  });
});
