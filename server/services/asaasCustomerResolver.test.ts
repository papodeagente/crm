import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock crmDb to avoid hitting the DB
vi.mock("../crmDb", () => ({
  setContactAsaasCustomerId: vi.fn().mockResolvedValue(undefined),
}));

import { resolveAsaasCustomerForContact } from "./asaasCustomerResolver";
import * as crm from "../crmDb";

beforeEach(() => {
  vi.clearAllMocks();
});

function makeClient(overrides: Partial<{
  findByCpfCnpj: any; findByEmail: any; createCustomer: any;
}> = {}) {
  return {
    findCustomerByCpfCnpj: overrides.findByCpfCnpj ?? vi.fn().mockResolvedValue({ data: [] }),
    findCustomerByEmail: overrides.findByEmail ?? vi.fn().mockResolvedValue({ data: [] }),
    createCustomer: overrides.createCustomer ?? vi.fn().mockResolvedValue({ id: "cus_NEW" }),
  } as any;
}

const baseContact = {
  id: 1, name: "Bruno", email: "bruno@x.com", docId: "12345678900",
  phone: "+5511999999999", phoneE164: "+5511999999999",
};

describe("resolveAsaasCustomerForContact", () => {
  it("usa o cache local sem chamar API quando asaasCustomerId está setado", async () => {
    const client = makeClient();
    const id = await resolveAsaasCustomerForContact(2, { ...baseContact, asaasCustomerId: "cus_CACHED" }, client);
    expect(id).toBe("cus_CACHED");
    expect(client.findCustomerByCpfCnpj).not.toHaveBeenCalled();
    expect(client.findCustomerByEmail).not.toHaveBeenCalled();
    expect(client.createCustomer).not.toHaveBeenCalled();
    // Não persiste de novo se já estava cacheado igual
    expect((crm.setContactAsaasCustomerId as any)).not.toHaveBeenCalled();
  });

  it("busca por CPF/CNPJ se cache vazio", async () => {
    const client = makeClient({ findByCpfCnpj: vi.fn().mockResolvedValue({ data: [{ id: "cus_CPF" }] }) });
    const id = await resolveAsaasCustomerForContact(2, baseContact, client);
    expect(id).toBe("cus_CPF");
    expect(client.findCustomerByCpfCnpj).toHaveBeenCalledWith("12345678900");
    expect(client.findCustomerByEmail).not.toHaveBeenCalled();
    expect(client.createCustomer).not.toHaveBeenCalled();
    expect((crm.setContactAsaasCustomerId as any)).toHaveBeenCalledWith(2, 1, "cus_CPF");
  });

  it("cai para email quando CPF não encontra", async () => {
    const client = makeClient({
      findByCpfCnpj: vi.fn().mockResolvedValue({ data: [] }),
      findByEmail: vi.fn().mockResolvedValue({ data: [{ id: "cus_EMAIL" }] }),
    });
    const id = await resolveAsaasCustomerForContact(2, baseContact, client);
    expect(id).toBe("cus_EMAIL");
    expect(client.findCustomerByEmail).toHaveBeenCalledWith("bruno@x.com");
    expect(client.createCustomer).not.toHaveBeenCalled();
  });

  it("cria novo customer quando nenhuma busca encontra", async () => {
    const client = makeClient();
    const id = await resolveAsaasCustomerForContact(2, baseContact, client);
    expect(id).toBe("cus_NEW");
    expect(client.createCustomer).toHaveBeenCalledWith(expect.objectContaining({
      name: "Bruno",
      cpfCnpj: "12345678900",
      email: "bruno@x.com",
      externalReference: "contact:1",
    }));
  });

  it("ignora erro silencioso na busca por CPF e segue para email", async () => {
    const client = makeClient({
      findByCpfCnpj: vi.fn().mockRejectedValue(new Error("API down")),
      findByEmail: vi.fn().mockResolvedValue({ data: [{ id: "cus_EMAIL" }] }),
    });
    const id = await resolveAsaasCustomerForContact(2, baseContact, client);
    expect(id).toBe("cus_EMAIL");
  });

  it("lança erro se contato não tem nome", async () => {
    const client = makeClient();
    await expect(
      resolveAsaasCustomerForContact(2, { ...baseContact, name: "" }, client)
    ).rejects.toThrow(/sem nome/i);
  });

  it("lança erro mapeado quando createCustomer falha", async () => {
    const client = makeClient({
      createCustomer: vi.fn().mockRejectedValue(new Error("docId inválido")),
    });
    await expect(
      resolveAsaasCustomerForContact(2, baseContact, client)
    ).rejects.toThrow(/Falha ao criar cliente/);
  });
});
