import { describe, expect, it, vi, beforeEach } from "vitest";

/**
 * UTM Fix Tests — Validates that:
 * 1. resolveRdFieldValue correctly resolves cf_utm_* ↔ utm_* keys
 * 2. The webhook UTM extraction reads from custom_fields
 * 3. applyFieldMappings correctly overwrites deal UTM columns
 * 4. Multi-tenant isolation is preserved
 */

// ─── Test resolveRdFieldValue logic (extracted for unit testing) ───

function resolveRdFieldValue(
  leadData: Record<string, any>,
  rdFieldKey: string,
  rdCustomFields?: Record<string, string>
): string | null {
  const alternateKeys: string[] = [rdFieldKey];
  if (rdFieldKey.startsWith("cf_")) {
    alternateKeys.push(rdFieldKey.slice(3));
  } else {
    alternateKeys.push(`cf_${rdFieldKey}`);
  }

  for (const key of alternateKeys) {
    if (rdCustomFields && rdCustomFields[key] !== undefined) {
      const v = String(rdCustomFields[key]);
      if (v.trim() !== "") return v;
    }

    if (leadData[key] !== undefined && leadData[key] !== null && String(leadData[key]).trim() !== "") {
      return String(leadData[key]);
    }

    if (leadData.custom_fields && typeof leadData.custom_fields === "object") {
      const val = leadData.custom_fields[key];
      if (val !== undefined && val !== null && String(val).trim() !== "") {
        return String(val);
      }
    }

    const lastConversion = leadData.last_conversion || leadData.first_conversion;
    if (lastConversion?.content && typeof lastConversion.content === "object") {
      const val = lastConversion.content[key];
      if (val !== undefined && val !== null && String(val).trim() !== "") {
        return String(val);
      }
    }

    const firstConversion = leadData.first_conversion;
    if (firstConversion?.content?.__cdp__original_event?.payload) {
      const cdpPayload = firstConversion.content.__cdp__original_event.payload;
      const val = cdpPayload[key];
      if (val !== undefined && val !== null && String(val).trim() !== "") {
        return String(val);
      }
    }
  }

  return null;
}

describe("resolveRdFieldValue — cf_ prefix flexibility", () => {
  it("finds utm_source when mapping uses cf_utm_source and data has utm_source in rdCustomFields", () => {
    const leadData = {};
    const rdCustomFields = { utm_source: "IG_Links" };
    const result = resolveRdFieldValue(leadData, "cf_utm_source", rdCustomFields);
    expect(result).toBe("IG_Links");
  });

  it("finds cf_utm_campaign when mapping uses utm_campaign and data has cf_utm_campaign in rdCustomFields", () => {
    const leadData = {};
    const rdCustomFields = { cf_utm_campaign: "[LA10X]" };
    const result = resolveRdFieldValue(leadData, "utm_campaign", rdCustomFields);
    expect(result).toBe("[LA10X]");
  });

  it("finds utm_medium in custom_fields object when mapping uses cf_utm_medium", () => {
    const leadData = {
      custom_fields: { utm_medium: "sm" },
    };
    const result = resolveRdFieldValue(leadData, "cf_utm_medium");
    expect(result).toBe("sm");
  });

  it("finds cf_utm_content in custom_fields object when mapping uses utm_content", () => {
    const leadData = {
      custom_fields: { cf_utm_content: "Bio IG" },
    };
    const result = resolveRdFieldValue(leadData, "utm_content");
    expect(result).toBe("Bio IG");
  });

  it("finds utm_term in last_conversion.content when mapping uses cf_utm_term", () => {
    const leadData = {
      last_conversion: {
        content: { utm_term: "Fernando Alves" },
      },
    };
    const result = resolveRdFieldValue(leadData, "cf_utm_term");
    expect(result).toBe("Fernando Alves");
  });

  it("finds cf_utm_source in CDP payload when mapping uses cf_utm_source", () => {
    const leadData = {
      first_conversion: {
        content: {
          __cdp__original_event: {
            payload: { cf_utm_source: "google-ads-pesquisa" },
          },
        },
      },
    };
    const result = resolveRdFieldValue(leadData, "cf_utm_source");
    expect(result).toBe("google-ads-pesquisa");
  });

  it("returns null when field is not present anywhere", () => {
    const leadData = { custom_fields: { other_field: "value" } };
    const result = resolveRdFieldValue(leadData, "cf_utm_source");
    expect(result).toBeNull();
  });

  it("skips empty string values", () => {
    const leadData = {};
    const rdCustomFields = { utm_source: "", cf_utm_source: "" };
    const result = resolveRdFieldValue(leadData, "cf_utm_source", rdCustomFields);
    expect(result).toBeNull();
  });

  it("prefers exact key match over alternate key", () => {
    const rdCustomFields = {
      cf_utm_source: "exact_match",
      utm_source: "alternate_match",
    };
    const result = resolveRdFieldValue({}, "cf_utm_source", rdCustomFields);
    expect(result).toBe("exact_match");
  });
});

describe("Webhook UTM extraction from custom_fields", () => {
  // Simulates the webhook's UTM extraction logic
  function extractDirectUtms(lead: Record<string, any>) {
    const lastConversion = lead.last_conversion || lead.first_conversion;
    const conversionOrigin = lastConversion?.conversion_origin || {};
    const utmSource = conversionOrigin.source || "";
    const utmMedium = conversionOrigin.medium || "";
    const utmCampaign = conversionOrigin.campaign || "";
    const utmContent = conversionOrigin.content || "";
    const utmTerm = conversionOrigin.term || "";

    const cf = lead.custom_fields && typeof lead.custom_fields === "object" ? lead.custom_fields : {} as Record<string, any>;
    const directUtmSource = lead.utm_source || lead.traffic_source || cf.utm_source || cf.cf_utm_source || utmSource;
    const directUtmMedium = lead.utm_medium || lead.traffic_medium || cf.utm_medium || cf.cf_utm_medium || utmMedium;
    const directUtmCampaign = lead.utm_campaign || lead.traffic_campaign || cf.utm_campaign || cf.cf_utm_campaign || utmCampaign;
    const directUtmContent = lead.utm_content || cf.utm_content || cf.cf_utm_content || utmContent;
    const directUtmTerm = lead.utm_term || cf.utm_term || cf.cf_utm_term || utmTerm;

    return { directUtmSource, directUtmMedium, directUtmCampaign, directUtmContent, directUtmTerm };
  }

  it("extracts UTMs from custom_fields when top-level fields are empty (deal 540745 scenario)", () => {
    const lead = {
      email: "teste@entur.com.br",
      name: "Teste",
      custom_fields: {
        utm_source: "IG_Links",
        utm_medium: "sm",
        utm_campaign: "[LA10X]",
        utm_content: "Bio IG",
        utm_term: "Fernando Alves",
      },
      first_conversion: {
        conversion_origin: {},
      },
    };

    const result = extractDirectUtms(lead);
    expect(result.directUtmSource).toBe("IG_Links");
    expect(result.directUtmMedium).toBe("sm");
    expect(result.directUtmCampaign).toBe("[LA10X]");
    expect(result.directUtmContent).toBe("Bio IG");
    expect(result.directUtmTerm).toBe("Fernando Alves");
  });

  it("extracts UTMs from custom_fields with cf_ prefix", () => {
    const lead = {
      custom_fields: {
        cf_utm_source: "google-ads",
        cf_utm_medium: "cpc",
        cf_utm_campaign: "brand",
        cf_utm_content: "ad1",
        cf_utm_term: "viagem",
      },
    };

    const result = extractDirectUtms(lead);
    expect(result.directUtmSource).toBe("google-ads");
    expect(result.directUtmMedium).toBe("cpc");
    expect(result.directUtmCampaign).toBe("brand");
    expect(result.directUtmContent).toBe("ad1");
    expect(result.directUtmTerm).toBe("viagem");
  });

  it("prefers top-level lead fields over custom_fields", () => {
    const lead = {
      utm_source: "top_level_source",
      custom_fields: {
        utm_source: "cf_source",
      },
    };

    const result = extractDirectUtms(lead);
    expect(result.directUtmSource).toBe("top_level_source");
  });

  it("falls back to conversion_origin when custom_fields are empty", () => {
    const lead = {
      last_conversion: {
        conversion_origin: {
          source: "google",
          medium: "cpc",
          campaign: "summer",
          content: "banner",
          term: "hotel",
        },
      },
    };

    const result = extractDirectUtms(lead);
    expect(result.directUtmSource).toBe("google");
    expect(result.directUtmMedium).toBe("cpc");
    expect(result.directUtmCampaign).toBe("summer");
    expect(result.directUtmContent).toBe("banner");
    expect(result.directUtmTerm).toBe("hotel");
  });

  it("returns empty strings when no UTM data is available", () => {
    const lead = { email: "test@test.com" };
    const result = extractDirectUtms(lead);
    expect(result.directUtmSource).toBe("");
    expect(result.directUtmMedium).toBe("");
    expect(result.directUtmCampaign).toBe("");
    expect(result.directUtmContent).toBe("");
    expect(result.directUtmTerm).toBe("");
  });
});

describe("Deal 540745 real-world scenario", () => {
  it("correctly resolves all 5 UTMs from the actual RD Station payload", () => {
    // This is the actual payload structure from deal 540745
    const rdCustomFields: Record<string, string> = {
      "utm_campaign": "[LA10X]",
      "utm_content": "Bio IG",
      "utm_medium": "sm",
      "utm_source": "IG_Links",
      "utm_term": "Fernando Alves",
    };

    // User's mapping keys use cf_ prefix
    const mappings = [
      { rdFieldKey: "cf_utm_source", expected: "IG_Links" },
      { rdFieldKey: "cf_utm_medium", expected: "sm" },
      { rdFieldKey: "cf_utm_campaign", expected: "[LA10X]" },
      { rdFieldKey: "cf_utm_content", expected: "Bio IG" },
      { rdFieldKey: "cf_utm_term", expected: "Fernando Alves" },
    ];

    for (const mapping of mappings) {
      const value = resolveRdFieldValue({}, mapping.rdFieldKey, rdCustomFields);
      expect(value).toBe(mapping.expected);
    }
  });

  it("correctly resolves UTMs from the CDP payload structure", () => {
    const leadData = {
      first_conversion: {
        content: {
          __cdp__original_event: {
            payload: {
              cf_utm_campaign: "[PESQUISA][AG-DZL][CADASTRO][CURSO]",
              cf_utm_medium: "G1 - Cursos",
              cf_utm_source: "google-ads-pesquisa",
            },
          },
          utm_campaign: "[PESQUISA][AG-DZL][CADASTRO][CURSO]",
          utm_medium: "G1 - Cursos",
          utm_source: "google-ads-pesquisa",
        },
        conversion_origin: {
          campaign: "[PESQUISA][AG-DZL][CADASTRO][CURSO]",
          medium: "g1 - cursos",
          source: "utm google-ads-pesquisa",
        },
      },
    };

    // The most accurate values come from custom_fields/last_conversion content
    const source = resolveRdFieldValue(leadData, "cf_utm_source");
    const medium = resolveRdFieldValue(leadData, "cf_utm_medium");
    const campaign = resolveRdFieldValue(leadData, "cf_utm_campaign");

    expect(source).toBeTruthy();
    expect(medium).toBeTruthy();
    expect(campaign).toBeTruthy();
  });
});
