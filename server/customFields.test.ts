import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createTestContext(): TrpcContext {
  const user: AuthenticatedUser = {
    id: 1,
    openId: "test-user",
    email: "test@example.com",
    name: "Test User",
    loginMethod: "manus",
    role: "admin",
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  };

  return {
    user,
    req: {
      protocol: "https",
      hostname: "test.manus.computer",
      headers: {},
    } as TrpcContext["req"],
    res: {
      clearCookie: () => {},
    } as TrpcContext["res"],
  };
}

const TENANT_ID = 1;

describe("customFields", () => {
  const ctx = createTestContext();
  const caller = appRouter.createCaller(ctx);
  let createdFieldId: number | null = null;

  it("lists custom fields for contact entity", async () => {
    const result = await caller.customFields.list({ tenantId: TENANT_ID, entity: "contact" });
    expect(Array.isArray(result)).toBe(true);
  });

  it("lists custom fields for deal entity", async () => {
    const result = await caller.customFields.list({ tenantId: TENANT_ID, entity: "deal" });
    expect(Array.isArray(result)).toBe(true);
  });

  it("lists custom fields for account entity", async () => {
    const result = await caller.customFields.list({ tenantId: TENANT_ID, entity: "account" });
    expect(Array.isArray(result)).toBe(true);
  });

  it("creates a custom field", async () => {
    const result = await caller.customFields.create({
      tenantId: TENANT_ID,
      entity: "contact",
      name: "test_field_vitest",
      label: "Test Field Vitest",
      fieldType: "text",
      placeholder: "Enter value",
      isRequired: false,
      isVisibleOnForm: true,
      isVisibleOnProfile: true,
      sortOrder: 999,
      groupName: "Test Group",
    });
    expect(result).toBeTruthy();
    expect(result.id).toBeGreaterThan(0);
    expect(result.name).toBe("test_field_vitest");
    expect(result.label).toBe("Test Field Vitest");
    expect(result.fieldType).toBe("text");
    createdFieldId = result.id;
  });

  it("creates a select custom field with options", async () => {
    const result = await caller.customFields.create({
      tenantId: TENANT_ID,
      entity: "deal",
      name: "test_select_vitest",
      label: "Test Select Vitest",
      fieldType: "select",
      optionsJson: ["Option A", "Option B", "Option C"],
      isVisibleOnForm: true,
      isVisibleOnProfile: true,
    });
    expect(result).toBeTruthy();
    expect(result.fieldType).toBe("select");
    // Clean up
    if (result.id) {
      await caller.customFields.delete({ tenantId: TENANT_ID, id: result.id });
    }
  });

  it("updates a custom field", async () => {
    if (!createdFieldId) return;
    const result = await caller.customFields.update({
      tenantId: TENANT_ID,
      id: createdFieldId,
      label: "Updated Test Field",
      placeholder: "Updated placeholder",
      isRequired: true,
    });
    expect(result).toBeTruthy();
    expect(result.label).toBe("Updated Test Field");
  });

  it("gets a custom field by id", async () => {
    if (!createdFieldId) return;
    const result = await caller.customFields.get({ tenantId: TENANT_ID, id: createdFieldId });
    expect(result).toBeTruthy();
    expect(result.id).toBe(createdFieldId);
  });

  it("deletes a custom field", async () => {
    if (!createdFieldId) return;
    const result = await caller.customFields.delete({ tenantId: TENANT_ID, id: createdFieldId });
    expect(result).toEqual({ success: true });

    // Verify it's gone
    const check = await caller.customFields.get({ tenantId: TENANT_ID, id: createdFieldId });
    expect(check).toBeNull();
  });
});

describe("contactProfile.customFieldValues", () => {
  const ctx = createTestContext();
  const caller = appRouter.createCaller(ctx);
  let testFieldId: number | null = null;

  it("creates a field for value testing", async () => {
    const field = await caller.customFields.create({
      tenantId: TENANT_ID,
      entity: "contact",
      name: "test_value_field_vitest",
      label: "Test Value Field",
      fieldType: "text",
      isVisibleOnForm: true,
      isVisibleOnProfile: true,
    });
    expect(field).toBeTruthy();
    testFieldId = field.id;
  });

  it("sets custom field values for a contact", async () => {
    if (!testFieldId) return;
    const result = await caller.contactProfile.setCustomFieldValues({
      tenantId: TENANT_ID,
      entityType: "contact",
      entityId: 1,
      values: [{ fieldId: testFieldId, value: "Hello World" }],
    });
    expect(result).toEqual({ success: true });
  });

  it("gets custom field values for a contact", async () => {
    if (!testFieldId) return;
    const result = await caller.contactProfile.getCustomFieldValues({
      tenantId: TENANT_ID,
      entityType: "contact",
      entityId: 1,
    });
    expect(Array.isArray(result)).toBe(true);
    const found = result.find((v: any) => v.fieldId === testFieldId);
    expect(found).toBeTruthy();
    expect(found.value).toBe("Hello World");
  });

  it("updates (upserts) custom field values", async () => {
    if (!testFieldId) return;
    const result = await caller.contactProfile.setCustomFieldValues({
      tenantId: TENANT_ID,
      entityType: "contact",
      entityId: 1,
      values: [{ fieldId: testFieldId, value: "Updated Value" }],
    });
    expect(result).toEqual({ success: true });

    const values = await caller.contactProfile.getCustomFieldValues({
      tenantId: TENANT_ID,
      entityType: "contact",
      entityId: 1,
    });
    const found = values.find((v: any) => v.fieldId === testFieldId);
    expect(found?.value).toBe("Updated Value");
  });

  it("sets custom field values for a deal", async () => {
    // Create a deal field
    const dealField = await caller.customFields.create({
      tenantId: TENANT_ID,
      entity: "deal",
      name: "test_deal_value_vitest",
      label: "Test Deal Value",
      fieldType: "number",
      isVisibleOnForm: true,
      isVisibleOnProfile: true,
    });
    expect(dealField).toBeTruthy();

    const result = await caller.contactProfile.setCustomFieldValues({
      tenantId: TENANT_ID,
      entityType: "deal",
      entityId: 1,
      values: [{ fieldId: dealField.id, value: "42" }],
    });
    expect(result).toEqual({ success: true });

    // Verify
    const values = await caller.contactProfile.getCustomFieldValues({
      tenantId: TENANT_ID,
      entityType: "deal",
      entityId: 1,
    });
    const found = values.find((v: any) => v.fieldId === dealField.id);
    expect(found?.value).toBe("42");

    // Clean up
    await caller.customFields.delete({ tenantId: TENANT_ID, id: dealField.id });
  });

  it("cleans up test field", async () => {
    if (!testFieldId) return;
    await caller.customFields.delete({ tenantId: TENANT_ID, id: testFieldId });
    const check = await caller.customFields.get({ tenantId: TENANT_ID, id: testFieldId });
    expect(check).toBeNull();
  });
});
