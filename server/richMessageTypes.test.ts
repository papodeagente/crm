import { describe, it, expect } from "vitest";

// ─── Test the extractMessageContent logic ───
// We replicate the core extraction logic here to test it independently

function extractMessageContent(data: any): string | null {
  const msg = data?.message;
  if (!msg) return data?.body || null;

  if (msg.conversation) return msg.conversation;
  if (msg.extendedTextMessage?.text) return msg.extendedTextMessage.text;
  if (msg.imageMessage?.caption) return msg.imageMessage.caption;
  if (msg.videoMessage?.caption) return msg.videoMessage.caption;
  if (msg.documentMessage?.caption) return msg.documentMessage.caption;
  if (msg.documentWithCaptionMessage?.message?.documentMessage?.caption)
    return msg.documentWithCaptionMessage.message.documentMessage.caption;

  // Template
  if (msg.templateMessage) {
    const tpl = msg.templateMessage;
    const hydrated = tpl.hydratedTemplate || tpl.hydratedFourRowTemplate;
    if (hydrated) {
      return hydrated.hydratedContentText || hydrated.hydratedTitleText || null;
    }
    const fourRow = tpl.fourRowTemplate;
    if (fourRow) return fourRow.content?.text || null;
    return null;
  }

  // Interactive
  if (msg.interactiveMessage) {
    return msg.interactiveMessage.body?.text || msg.interactiveMessage.header?.title || null;
  }

  // Buttons
  if (msg.buttonsMessage) {
    return msg.buttonsMessage.contentText || msg.buttonsMessage.text || null;
  }

  // List
  if (msg.listMessage) {
    return msg.listMessage.description || msg.listMessage.title || null;
  }

  // Response messages
  if (msg.listResponseMessage?.title) return msg.listResponseMessage.title;
  if (msg.buttonsResponseMessage?.selectedDisplayText) return msg.buttonsResponseMessage.selectedDisplayText;
  if (msg.templateButtonReplyMessage?.selectedDisplayText) return msg.templateButtonReplyMessage.selectedDisplayText;
  if (msg.interactiveResponseMessage) {
    return msg.interactiveResponseMessage.body?.text || null;
  }

  // Contact
  if (msg.contactMessage) return `👤 ${msg.contactMessage.displayName || "Contato"}`;
  if (msg.contactsArrayMessage) {
    const contacts = msg.contactsArrayMessage.contacts || [];
    const names = contacts.map((c: any) => c.displayName).filter(Boolean).join(", ");
    return names ? `👥 ${names}` : "👥 Contatos";
  }

  // Location
  if (msg.locationMessage) {
    return msg.locationMessage.name || msg.locationMessage.address || "📍 Localização";
  }
  if (msg.liveLocationMessage) return "📍 Localização ao vivo";

  // Poll
  if (msg.pollCreationMessage || msg.pollCreationMessageV2 || msg.pollCreationMessageV3) {
    const poll = msg.pollCreationMessage || msg.pollCreationMessageV2 || msg.pollCreationMessageV3;
    return `📊 ${poll.name || "Enquete"}`;
  }

  // Order
  if (msg.orderMessage) {
    return `🛒 Pedido${msg.orderMessage.orderTitle ? `: ${msg.orderMessage.orderTitle}` : ""}`;
  }

  // Product
  if (msg.productMessage) {
    const product = msg.productMessage.product;
    return product?.title ? `🛍️ ${product.title}` : "🛍️ Produto";
  }

  // Group invite
  if (msg.groupInviteMessage) {
    return `👥 Convite: ${msg.groupInviteMessage.groupName || "Grupo"}`;
  }

  // View once
  if (msg.viewOnceMessage?.message) {
    return extractMessageContent({ message: msg.viewOnceMessage.message });
  }

  // Media without caption
  if (msg.stickerMessage) return null;
  if (msg.audioMessage || msg.pttMessage) return null;
  if (msg.imageMessage) return null;
  if (msg.videoMessage) return null;

  return data?.body || null;
}

// ─── Test resolveMessageType logic ───

function resolveMessageType(data: any): string {
  const reportedType = data?.messageType || "conversation";
  const msg = data?.message;
  if (!msg) return reportedType;

  if (msg.templateMessage) return "templateMessage";
  if (msg.interactiveMessage) return "interactiveMessage";
  if (msg.buttonsMessage) return "buttonsMessage";
  if (msg.listMessage) return "listMessage";
  if (msg.listResponseMessage) return "listResponseMessage";
  if (msg.buttonsResponseMessage) return "buttonsResponseMessage";
  if (msg.templateButtonReplyMessage) return "templateButtonReplyMessage";
  if (msg.interactiveResponseMessage) return "interactiveResponseMessage";
  if (msg.stickerMessage) return "stickerMessage";
  if (msg.imageMessage) return "imageMessage";
  if (msg.videoMessage) return "videoMessage";
  if (msg.audioMessage) return "audioMessage";
  if (msg.pttMessage) return "pttMessage";
  if (msg.documentMessage) return "documentMessage";
  if (msg.extendedTextMessage) return "extendedTextMessage";
  if (msg.conversation !== undefined) return "conversation";
  if (msg.contactMessage) return "contactMessage";
  if (msg.contactsArrayMessage) return "contactsArrayMessage";
  if (msg.locationMessage) return "locationMessage";
  if (msg.liveLocationMessage) return "liveLocationMessage";
  if (msg.pollCreationMessage || msg.pollCreationMessageV2 || msg.pollCreationMessageV3) return "pollCreationMessageV3";
  if (msg.orderMessage) return "orderMessage";
  if (msg.productMessage) return "productMessage";
  if (msg.groupInviteMessage) return "groupInviteMessage";
  if (msg.albumMessage) return "albumMessage";
  if (msg.viewOnceMessage) return "viewOnceMessage";
  if (msg.viewOnceMessageV2) return "viewOnceMessageV2";
  if (msg.reactionMessage) return "reactionMessage";
  if (msg.protocolMessage) return "protocolMessage";

  return reportedType;
}

// ─── Test extractStructuredData logic ───

function extractStructuredData(data: any): any | null {
  const msg = data?.message;
  if (!msg) return null;

  if (msg.templateMessage) {
    const tpl = msg.templateMessage;
    const hydrated = tpl.hydratedTemplate || tpl.hydratedFourRowTemplate;
    if (hydrated) {
      return {
        type: "template",
        title: hydrated.hydratedTitleText || null,
        body: hydrated.hydratedContentText || null,
        footer: hydrated.hydratedFooterText || null,
        buttons: (hydrated.hydratedButtons || []).map((btn: any) => {
          if (btn.urlButton) return { type: "url", text: btn.urlButton.displayText, url: btn.urlButton.url };
          if (btn.callButton) return { type: "call", text: btn.callButton.displayText, phone: btn.callButton.phoneNumber };
          if (btn.quickReplyButton) return { type: "reply", text: btn.quickReplyButton.displayText, id: btn.quickReplyButton.id };
          return { type: "unknown", text: "Botão" };
        }),
        hasImage: !!hydrated.imageMessage,
      };
    }
    return null;
  }

  if (msg.interactiveMessage) {
    const im = msg.interactiveMessage;
    const buttons: any[] = [];
    if (im.nativeFlowMessage?.buttons) {
      for (const btn of im.nativeFlowMessage.buttons) {
        try {
          const params = JSON.parse(btn.buttonParamsJson || "{}");
          buttons.push({ type: btn.name, text: params.display_text || "Botão", url: params.url, copyCode: params.copy_code });
        } catch { buttons.push({ type: btn.name, text: "Botão" }); }
      }
    }
    return {
      type: "interactive",
      header: im.header?.title || null,
      body: im.body?.text || null,
      footer: im.footer?.text || null,
      buttons,
    };
  }

  if (msg.buttonsMessage) {
    return {
      type: "buttons",
      text: msg.buttonsMessage.contentText || null,
      footer: msg.buttonsMessage.footerText || null,
      buttons: (msg.buttonsMessage.buttons || []).map((btn: any) => ({
        type: "reply",
        text: btn.buttonText?.displayText || "Botão",
        id: btn.buttonId || null,
      })),
    };
  }

  if (msg.listMessage) {
    return {
      type: "list",
      title: msg.listMessage.title || null,
      description: msg.listMessage.description || null,
      buttonText: msg.listMessage.buttonText || "Ver opções",
      sections: (msg.listMessage.sections || []).map((s: any) => ({
        title: s.title || null,
        rows: (s.rows || []).map((r: any) => ({
          title: r.title || null,
          description: r.description || null,
          id: r.rowId || null,
        })),
      })),
    };
  }

  if (msg.listResponseMessage) {
    return {
      type: "listResponse",
      title: msg.listResponseMessage.title || null,
      description: msg.listResponseMessage.description || null,
      selectedRowId: msg.listResponseMessage.singleSelectReply?.selectedRowId || null,
    };
  }

  if (msg.buttonsResponseMessage) {
    return {
      type: "buttonsResponse",
      selectedText: msg.buttonsResponseMessage.selectedDisplayText || null,
      selectedId: msg.buttonsResponseMessage.selectedButtonId || null,
    };
  }

  if (msg.pollCreationMessage || msg.pollCreationMessageV2 || msg.pollCreationMessageV3) {
    const poll = msg.pollCreationMessage || msg.pollCreationMessageV2 || msg.pollCreationMessageV3;
    return {
      type: "poll",
      question: poll.name || null,
      options: (poll.options || []).map((o: any) => o.optionName || ""),
      selectableCount: poll.selectableOptionsCount || 1,
    };
  }

  if (msg.orderMessage) {
    return {
      type: "order",
      orderId: msg.orderMessage.orderId || null,
      title: msg.orderMessage.orderTitle || null,
      itemCount: msg.orderMessage.itemCount || null,
    };
  }

  if (msg.productMessage) {
    const p = msg.productMessage.product;
    return {
      type: "product",
      title: p?.title || null,
      price: p?.priceAmount1000 ? (p.priceAmount1000 / 1000) : null,
      currency: p?.currencyCode || "BRL",
    };
  }

  if (msg.contactMessage) {
    return {
      type: "contact",
      displayName: msg.contactMessage.displayName || null,
      vcard: msg.contactMessage.vcard || null,
    };
  }

  if (msg.locationMessage) {
    return {
      type: "location",
      latitude: msg.locationMessage.degreesLatitude || null,
      longitude: msg.locationMessage.degreesLongitude || null,
      name: msg.locationMessage.name || null,
      address: msg.locationMessage.address || null,
    };
  }

  return null;
}

// ─── Test getPreviewForType logic ───

function getPreviewForType(messageType: string): string | null {
  const previews: Record<string, string> = {
    imageMessage: "📷 Imagem",
    videoMessage: "🎥 Vídeo",
    audioMessage: "🎧 Áudio",
    pttMessage: "🎤 Áudio",
    documentMessage: "📄 Documento",
    stickerMessage: "🏷️ Figurinha",
    contactMessage: "👤 Contato",
    locationMessage: "📍 Localização",
    liveLocationMessage: "📍 Localização ao vivo",
    contactsArrayMessage: "👥 Contatos",
    listMessage: "📋 Lista",
    buttonsMessage: "🔘 Botões",
    templateMessage: "📝 Template",
    interactiveMessage: "🔘 Mensagem interativa",
    listResponseMessage: "✅ Resposta da lista",
    buttonsResponseMessage: "✅ Resposta do botão",
    templateButtonReplyMessage: "✅ Resposta do template",
    interactiveResponseMessage: "✅ Resposta interativa",
    orderMessage: "🛒 Pedido",
    productMessage: "🛍️ Produto",
    groupInviteMessage: "👥 Convite de grupo",
    pollCreationMessage: "📊 Enquete",
    pollCreationMessageV3: "📊 Enquete",
    pollUpdateMessage: "📊 Voto na enquete",
    viewOnceMessage: "📷 Visualização única",
    viewOnceMessageV2: "📷 Visualização única",
    albumMessage: "📷 Álbum",
    associatedChildMessage: "📷 Foto do álbum",
    lottieStickerMessage: "🏷️ Figurinha animada",
    editedMessage: "✏️ Editada",
    placeholderMessage: "💬 Mensagem",
    ptvMessage: "🎥 Vídeo circular",
  };
  return previews[messageType] || null;
}

// ═══════════════════════════════════════════════════════
// TESTS
// ═══════════════════════════════════════════════════════

describe("Rich Message Types — extractMessageContent", () => {
  it("extracts text from templateMessage with hydratedTemplate", () => {
    const data = {
      message: {
        templateMessage: {
          hydratedTemplate: {
            hydratedContentText: "Olá! Seu pedido foi confirmado.",
            hydratedTitleText: "Confirmação de Pedido",
            hydratedFooterText: "Loja XYZ",
            hydratedButtons: [
              { urlButton: { displayText: "Ver pedido", url: "https://example.com" } },
            ],
          },
        },
      },
    };
    expect(extractMessageContent(data)).toBe("Olá! Seu pedido foi confirmado.");
  });

  it("extracts title from templateMessage when body is missing", () => {
    const data = {
      message: {
        templateMessage: {
          hydratedTemplate: {
            hydratedTitleText: "Promoção Especial",
          },
        },
      },
    };
    expect(extractMessageContent(data)).toBe("Promoção Especial");
  });

  it("returns null for templateMessage without hydrated data", () => {
    const data = { message: { templateMessage: {} } };
    expect(extractMessageContent(data)).toBeNull();
  });

  it("extracts body from interactiveMessage", () => {
    const data = {
      message: {
        interactiveMessage: {
          body: { text: "Escolha uma opção abaixo:" },
          header: { title: "Menu" },
          nativeFlowMessage: { buttons: [] },
        },
      },
    };
    expect(extractMessageContent(data)).toBe("Escolha uma opção abaixo:");
  });

  it("extracts header from interactiveMessage when body is missing", () => {
    const data = {
      message: {
        interactiveMessage: {
          header: { title: "Catálogo" },
        },
      },
    };
    expect(extractMessageContent(data)).toBe("Catálogo");
  });

  it("extracts contentText from buttonsMessage", () => {
    const data = {
      message: {
        buttonsMessage: {
          contentText: "Escolha uma opção:",
          buttons: [
            { buttonId: "1", buttonText: { displayText: "Opção 1" } },
            { buttonId: "2", buttonText: { displayText: "Opção 2" } },
          ],
        },
      },
    };
    expect(extractMessageContent(data)).toBe("Escolha uma opção:");
  });

  it("extracts description from listMessage", () => {
    const data = {
      message: {
        listMessage: {
          title: "Menu Principal",
          description: "Selecione um item do menu",
          buttonText: "Ver opções",
          sections: [{ title: "Seção 1", rows: [{ title: "Item 1" }] }],
        },
      },
    };
    expect(extractMessageContent(data)).toBe("Selecione um item do menu");
  });

  it("extracts title from listMessage when description is missing", () => {
    const data = {
      message: {
        listMessage: {
          title: "Menu Principal",
          buttonText: "Ver opções",
        },
      },
    };
    expect(extractMessageContent(data)).toBe("Menu Principal");
  });

  it("extracts title from listResponseMessage", () => {
    const data = {
      message: {
        listResponseMessage: {
          title: "Item selecionado",
          singleSelectReply: { selectedRowId: "row1" },
        },
      },
    };
    expect(extractMessageContent(data)).toBe("Item selecionado");
  });

  it("extracts selectedDisplayText from buttonsResponseMessage", () => {
    const data = {
      message: {
        buttonsResponseMessage: {
          selectedDisplayText: "Opção 1",
          selectedButtonId: "btn1",
        },
      },
    };
    expect(extractMessageContent(data)).toBe("Opção 1");
  });

  it("extracts selectedDisplayText from templateButtonReplyMessage", () => {
    const data = {
      message: {
        templateButtonReplyMessage: {
          selectedDisplayText: "Ver mais",
          selectedId: "btn-1",
        },
      },
    };
    expect(extractMessageContent(data)).toBe("Ver mais");
  });

  it("extracts contact name from contactMessage", () => {
    const data = {
      message: { contactMessage: { displayName: "João Silva", vcard: "BEGIN:VCARD..." } },
    };
    expect(extractMessageContent(data)).toBe("👤 João Silva");
  });

  it("extracts contact names from contactsArrayMessage", () => {
    const data = {
      message: {
        contactsArrayMessage: {
          contacts: [
            { displayName: "Ana" },
            { displayName: "Bruno" },
          ],
        },
      },
    };
    expect(extractMessageContent(data)).toBe("👥 Ana, Bruno");
  });

  it("extracts location name", () => {
    const data = {
      message: {
        locationMessage: {
          degreesLatitude: -23.5505,
          degreesLongitude: -46.6333,
          name: "São Paulo",
          address: "São Paulo, SP",
        },
      },
    };
    expect(extractMessageContent(data)).toBe("São Paulo");
  });

  it("extracts poll question", () => {
    const data = {
      message: {
        pollCreationMessageV3: {
          name: "Qual a melhor cor?",
          options: [{ optionName: "Azul" }, { optionName: "Verde" }],
        },
      },
    };
    expect(extractMessageContent(data)).toBe("📊 Qual a melhor cor?");
  });

  it("extracts order title", () => {
    const data = {
      message: {
        orderMessage: {
          orderId: "123",
          orderTitle: "Pedido #123",
          itemCount: 3,
        },
      },
    };
    expect(extractMessageContent(data)).toBe("🛒 Pedido: Pedido #123");
  });

  it("extracts product title", () => {
    const data = {
      message: {
        productMessage: {
          product: {
            title: "Camiseta Premium",
            priceAmount1000: 49900,
            currencyCode: "BRL",
          },
        },
      },
    };
    expect(extractMessageContent(data)).toBe("🛍️ Camiseta Premium");
  });

  it("extracts group invite name", () => {
    const data = {
      message: {
        groupInviteMessage: {
          groupName: "Grupo de Vendas",
          inviteCode: "ABC123",
        },
      },
    };
    expect(extractMessageContent(data)).toBe("👥 Convite: Grupo de Vendas");
  });

  it("handles viewOnceMessage by unwrapping inner message", () => {
    const data = {
      message: {
        viewOnceMessage: {
          message: {
            imageMessage: { caption: "Foto secreta" },
          },
        },
      },
    };
    expect(extractMessageContent(data)).toBe("Foto secreta");
  });

  it("returns null for media without caption", () => {
    expect(extractMessageContent({ message: { stickerMessage: {} } })).toBeNull();
    expect(extractMessageContent({ message: { audioMessage: {} } })).toBeNull();
    expect(extractMessageContent({ message: { imageMessage: {} } })).toBeNull();
  });

  it("falls back to data.body when message has no recognized type", () => {
    const data = { body: "Fallback body text", message: {} };
    expect(extractMessageContent(data)).toBe("Fallback body text");
  });
});

describe("Rich Message Types — resolveMessageType", () => {
  it("detects templateMessage", () => {
    expect(resolveMessageType({ message: { templateMessage: {} } })).toBe("templateMessage");
  });

  it("detects interactiveMessage", () => {
    expect(resolveMessageType({ message: { interactiveMessage: {} } })).toBe("interactiveMessage");
  });

  it("detects buttonsMessage", () => {
    expect(resolveMessageType({ message: { buttonsMessage: {} } })).toBe("buttonsMessage");
  });

  it("detects listMessage", () => {
    expect(resolveMessageType({ message: { listMessage: {} } })).toBe("listMessage");
  });

  it("detects listResponseMessage", () => {
    expect(resolveMessageType({ message: { listResponseMessage: {} } })).toBe("listResponseMessage");
  });

  it("detects buttonsResponseMessage", () => {
    expect(resolveMessageType({ message: { buttonsResponseMessage: {} } })).toBe("buttonsResponseMessage");
  });

  it("detects templateButtonReplyMessage", () => {
    expect(resolveMessageType({ message: { templateButtonReplyMessage: {} } })).toBe("templateButtonReplyMessage");
  });

  it("detects pollCreationMessageV3", () => {
    expect(resolveMessageType({ message: { pollCreationMessageV3: {} } })).toBe("pollCreationMessageV3");
  });

  it("detects orderMessage", () => {
    expect(resolveMessageType({ message: { orderMessage: {} } })).toBe("orderMessage");
  });

  it("detects productMessage", () => {
    expect(resolveMessageType({ message: { productMessage: {} } })).toBe("productMessage");
  });

  it("detects groupInviteMessage", () => {
    expect(resolveMessageType({ message: { groupInviteMessage: {} } })).toBe("groupInviteMessage");
  });

  it("detects albumMessage", () => {
    expect(resolveMessageType({ message: { albumMessage: {} } })).toBe("albumMessage");
  });

  it("detects viewOnceMessage", () => {
    expect(resolveMessageType({ message: { viewOnceMessage: {} } })).toBe("viewOnceMessage");
  });

  it("detects reactionMessage", () => {
    expect(resolveMessageType({ message: { reactionMessage: {} } })).toBe("reactionMessage");
  });

  it("prioritizes templateMessage over imageMessage (template with image header)", () => {
    expect(resolveMessageType({
      message: { templateMessage: { hydratedTemplate: { imageMessage: {} } } },
    })).toBe("templateMessage");
  });

  it("falls back to reportedType when message is null", () => {
    expect(resolveMessageType({ messageType: "custom" })).toBe("custom");
  });

  it("falls back to 'conversation' when nothing matches", () => {
    expect(resolveMessageType({})).toBe("conversation");
  });
});

describe("Rich Message Types — extractStructuredData", () => {
  it("extracts template structured data with buttons", () => {
    const data = {
      message: {
        templateMessage: {
          hydratedTemplate: {
            hydratedTitleText: "Título",
            hydratedContentText: "Corpo do template",
            hydratedFooterText: "Rodapé",
            hydratedButtons: [
              { urlButton: { displayText: "Visitar", url: "https://example.com" } },
              { callButton: { displayText: "Ligar", phoneNumber: "+5511999999999" } },
              { quickReplyButton: { displayText: "Responder", id: "btn1" } },
            ],
          },
        },
      },
    };
    const sd = extractStructuredData(data);
    expect(sd).not.toBeNull();
    expect(sd.type).toBe("template");
    expect(sd.title).toBe("Título");
    expect(sd.body).toBe("Corpo do template");
    expect(sd.footer).toBe("Rodapé");
    expect(sd.buttons).toHaveLength(3);
    expect(sd.buttons[0]).toEqual({ type: "url", text: "Visitar", url: "https://example.com" });
    expect(sd.buttons[1]).toEqual({ type: "call", text: "Ligar", phone: "+5511999999999" });
    expect(sd.buttons[2]).toEqual({ type: "reply", text: "Responder", id: "btn1" });
  });

  it("extracts interactive structured data with nativeFlow buttons", () => {
    const data = {
      message: {
        interactiveMessage: {
          header: { title: "Menu" },
          body: { text: "Escolha:" },
          footer: { text: "Powered by Bot" },
          nativeFlowMessage: {
            buttons: [
              { name: "quick_reply", buttonParamsJson: '{"display_text":"Opção 1","id":"1"}' },
              { name: "cta_url", buttonParamsJson: '{"display_text":"Site","url":"https://example.com"}' },
            ],
          },
        },
      },
    };
    const sd = extractStructuredData(data);
    expect(sd).not.toBeNull();
    expect(sd.type).toBe("interactive");
    expect(sd.header).toBe("Menu");
    expect(sd.body).toBe("Escolha:");
    expect(sd.buttons).toHaveLength(2);
    expect(sd.buttons[0].text).toBe("Opção 1");
    expect(sd.buttons[1].url).toBe("https://example.com");
  });

  it("extracts buttons structured data", () => {
    const data = {
      message: {
        buttonsMessage: {
          contentText: "Escolha:",
          footerText: "Rodapé",
          buttons: [
            { buttonId: "1", buttonText: { displayText: "Sim" } },
            { buttonId: "2", buttonText: { displayText: "Não" } },
          ],
        },
      },
    };
    const sd = extractStructuredData(data);
    expect(sd).not.toBeNull();
    expect(sd.type).toBe("buttons");
    expect(sd.buttons).toHaveLength(2);
    expect(sd.buttons[0].text).toBe("Sim");
    expect(sd.buttons[1].text).toBe("Não");
  });

  it("extracts list structured data with sections", () => {
    const data = {
      message: {
        listMessage: {
          title: "Menu",
          description: "Escolha um item",
          buttonText: "Ver opções",
          sections: [
            {
              title: "Seção 1",
              rows: [
                { title: "Item A", description: "Descrição A", rowId: "a" },
                { title: "Item B", description: "Descrição B", rowId: "b" },
              ],
            },
          ],
        },
      },
    };
    const sd = extractStructuredData(data);
    expect(sd).not.toBeNull();
    expect(sd.type).toBe("list");
    expect(sd.sections).toHaveLength(1);
    expect(sd.sections[0].rows).toHaveLength(2);
    expect(sd.sections[0].rows[0].title).toBe("Item A");
  });

  it("extracts listResponse structured data", () => {
    const data = {
      message: {
        listResponseMessage: {
          title: "Item A",
          description: "Descrição A",
          singleSelectReply: { selectedRowId: "a" },
        },
      },
    };
    const sd = extractStructuredData(data);
    expect(sd).not.toBeNull();
    expect(sd.type).toBe("listResponse");
    expect(sd.title).toBe("Item A");
    expect(sd.selectedRowId).toBe("a");
  });

  it("extracts poll structured data", () => {
    const data = {
      message: {
        pollCreationMessageV3: {
          name: "Qual a melhor cor?",
          options: [{ optionName: "Azul" }, { optionName: "Verde" }, { optionName: "Vermelho" }],
          selectableOptionsCount: 1,
        },
      },
    };
    const sd = extractStructuredData(data);
    expect(sd).not.toBeNull();
    expect(sd.type).toBe("poll");
    expect(sd.question).toBe("Qual a melhor cor?");
    expect(sd.options).toEqual(["Azul", "Verde", "Vermelho"]);
    expect(sd.selectableCount).toBe(1);
  });

  it("extracts order structured data", () => {
    const data = {
      message: {
        orderMessage: {
          orderId: "123",
          orderTitle: "Pedido #123",
          itemCount: 3,
        },
      },
    };
    const sd = extractStructuredData(data);
    expect(sd).not.toBeNull();
    expect(sd.type).toBe("order");
    expect(sd.orderId).toBe("123");
    expect(sd.itemCount).toBe(3);
  });

  it("extracts product structured data with price conversion", () => {
    const data = {
      message: {
        productMessage: {
          product: {
            title: "Camiseta",
            priceAmount1000: 49900,
            currencyCode: "BRL",
          },
        },
      },
    };
    const sd = extractStructuredData(data);
    expect(sd).not.toBeNull();
    expect(sd.type).toBe("product");
    expect(sd.title).toBe("Camiseta");
    expect(sd.price).toBe(49.9);
    expect(sd.currency).toBe("BRL");
  });

  it("extracts contact structured data", () => {
    const data = {
      message: {
        contactMessage: {
          displayName: "João",
          vcard: "BEGIN:VCARD\nTEL:+5511999999999\nEND:VCARD",
        },
      },
    };
    const sd = extractStructuredData(data);
    expect(sd).not.toBeNull();
    expect(sd.type).toBe("contact");
    expect(sd.displayName).toBe("João");
  });

  it("extracts location structured data", () => {
    const data = {
      message: {
        locationMessage: {
          degreesLatitude: -23.5505,
          degreesLongitude: -46.6333,
          name: "São Paulo",
          address: "SP, Brasil",
        },
      },
    };
    const sd = extractStructuredData(data);
    expect(sd).not.toBeNull();
    expect(sd.type).toBe("location");
    expect(sd.latitude).toBe(-23.5505);
    expect(sd.name).toBe("São Paulo");
  });

  it("returns null for simple text messages", () => {
    expect(extractStructuredData({ message: { conversation: "Hello" } })).toBeNull();
    expect(extractStructuredData({ message: { extendedTextMessage: { text: "Hi" } } })).toBeNull();
  });

  it("returns null for media messages", () => {
    expect(extractStructuredData({ message: { imageMessage: {} } })).toBeNull();
    expect(extractStructuredData({ message: { audioMessage: {} } })).toBeNull();
  });
});

describe("Rich Message Types — getPreviewForType", () => {
  it("returns preview for all rich message types", () => {
    const richTypes = [
      "templateMessage", "interactiveMessage", "buttonsMessage", "listMessage",
      "listResponseMessage", "buttonsResponseMessage", "templateButtonReplyMessage",
      "interactiveResponseMessage", "orderMessage", "productMessage",
      "groupInviteMessage", "pollCreationMessage", "pollCreationMessageV3",
      "pollUpdateMessage", "viewOnceMessage", "viewOnceMessageV2",
      "albumMessage", "associatedChildMessage", "lottieStickerMessage",
      "editedMessage", "placeholderMessage", "ptvMessage",
    ];
    for (const type of richTypes) {
      const preview = getPreviewForType(type);
      expect(preview, `Missing preview for ${type}`).not.toBeNull();
      expect(preview!.length, `Empty preview for ${type}`).toBeGreaterThan(0);
    }
  });

  it("returns preview for media types", () => {
    const mediaTypes = [
      "imageMessage", "videoMessage", "audioMessage", "pttMessage",
      "documentMessage", "stickerMessage",
    ];
    for (const type of mediaTypes) {
      expect(getPreviewForType(type), `Missing preview for ${type}`).not.toBeNull();
    }
  });

  it("returns null for unknown types", () => {
    expect(getPreviewForType("unknownType")).toBeNull();
    expect(getPreviewForType("customMessage")).toBeNull();
  });
});

describe("Rich Message Types — Frontend getMessagePreview", () => {
  function getMessagePreview(content: string | null, messageType: string | null): string {
    if (!messageType || messageType === "text" || messageType === "conversation" || messageType === "extendedTextMessage") {
      return content || "";
    }
    const typeMap: Record<string, string> = {
      imageMessage: "📷 Foto", videoMessage: "📹 Vídeo",
      audioMessage: "🎤 Áudio", pttMessage: "🎤 Áudio",
      documentMessage: "📄 Documento",
      stickerMessage: "🏷️ Sticker",
      templateMessage: "📝 Template",
      interactiveMessage: "🔘 Mensagem interativa",
      buttonsMessage: "🔘 Botões",
      listMessage: "📋 Lista",
      listResponseMessage: "✅ Resposta da lista",
      buttonsResponseMessage: "✅ Resposta do botão",
      orderMessage: "🛒 Pedido",
      productMessage: "🛍️ Produto",
      albumMessage: "📷 Álbum",
      pollCreationMessageV3: "📊 Enquete",
    };
    if (content && content.length > 0 && !content.startsWith("[")) {
      const prefix = typeMap[messageType];
      if (prefix && (messageType === "templateMessage" || messageType === "interactiveMessage" ||
          messageType === "buttonsMessage" || messageType === "listMessage")) {
        const emoji = prefix.split(" ")[0];
        return `${emoji} ${content}`;
      }
      return content;
    }
    return typeMap[messageType] || content || "";
  }

  it("shows emoji + content for template messages with content", () => {
    expect(getMessagePreview("Seu pedido foi confirmado", "templateMessage")).toBe("📝 Seu pedido foi confirmado");
  });

  it("shows emoji + content for interactive messages with content", () => {
    expect(getMessagePreview("Escolha uma opção", "interactiveMessage")).toBe("🔘 Escolha uma opção");
  });

  it("shows type label when content is null", () => {
    expect(getMessagePreview(null, "templateMessage")).toBe("📝 Template");
    expect(getMessagePreview(null, "interactiveMessage")).toBe("🔘 Mensagem interativa");
    expect(getMessagePreview(null, "buttonsMessage")).toBe("🔘 Botões");
    expect(getMessagePreview(null, "listMessage")).toBe("📋 Lista");
  });

  it("shows type label for bracket placeholders", () => {
    expect(getMessagePreview("[Template]", "templateMessage")).toBe("📝 Template");
  });

  it("shows real content for response messages", () => {
    expect(getMessagePreview("Opção 1", "buttonsResponseMessage")).toBe("Opção 1");
    expect(getMessagePreview("Item selecionado", "listResponseMessage")).toBe("Item selecionado");
  });

  it("shows type label for order/product without content", () => {
    expect(getMessagePreview(null, "orderMessage")).toBe("🛒 Pedido");
    expect(getMessagePreview(null, "productMessage")).toBe("🛍️ Produto");
  });

  it("passes through text messages unchanged", () => {
    expect(getMessagePreview("Hello world", "conversation")).toBe("Hello world");
    expect(getMessagePreview("Hello world", "extendedTextMessage")).toBe("Hello world");
  });
});
