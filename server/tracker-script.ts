/**
 * Tracker Script Generator
 *
 * Returns the JavaScript code that runs on the client's website.
 * The script:
 *   1. Listens for all form submit events (delegation on document)
 *   2. Extracts fields using heuristic matching (name, type, id, placeholder)
 *   3. Sends captured data to POST /api/collect
 *   4. Captures UTM params from URL and referrer automatically
 *   5. Works with any form plugin (Elementor, CF7, Gravity, raw HTML)
 */

export function generateTrackerScript(token: string, baseUrl: string): string {
  return `(function(){
  "use strict";
  if(window.__entur_tracker_loaded) return;
  window.__entur_tracker_loaded = true;

  var TOKEN = "${token}";
  var BASE  = "${baseUrl}";

  // ─── UTM & Page Info ──────────────────────────────────
  function getUtm(){
    var p = new URLSearchParams(window.location.search);
    var u = {};
    ["utm_source","utm_medium","utm_campaign","utm_content","utm_term"].forEach(function(k){
      var v = p.get(k);
      if(v) u[k.replace("utm_","")] = v;
    });
    return Object.keys(u).length ? u : null;
  }

  function getPageInfo(){
    return {
      url: window.location.href,
      referrer: document.referrer || null,
      title: document.title || null
    };
  }

  // ─── Field Heuristic Engine ───────────────────────────
  // Maps form fields to semantic roles by analyzing name, id, type, placeholder, label
  var FIELD_PATTERNS = {
    email: {
      type: ["email"],
      name: [/e-?mail/i, /correo/i],
      placeholder: [/e-?mail/i, /seu\\s*e-?mail/i, /your\\s*e-?mail/i]
    },
    phone: {
      type: ["tel"],
      name: [/phone/i, /tel/i, /fone/i, /celular/i, /whatsapp/i, /wpp/i, /mobile/i, /telefone/i],
      placeholder: [/telefone/i, /celular/i, /whatsapp/i, /\\(\\d{2}\\)/i, /phone/i]
    },
    name: {
      name: [/^name$/i, /^nome$/i, /full.?name/i, /nome.?completo/i, /your.?name/i, /seu.?nome/i, /first.?name/i, /primeiro.?nome/i],
      placeholder: [/nome/i, /name/i, /seu\\s*nome/i, /your\\s*name/i]
    },
    message: {
      type: ["textarea"],
      name: [/message/i, /mensagem/i, /comment/i, /coment/i, /descri/i, /observa/i, /assunto/i, /subject/i],
      placeholder: [/mensagem/i, /message/i, /como\\s*podemos/i, /diga/i]
    }
  };

  function getLabel(el){
    // Check for associated label
    if(el.id){
      var lbl = document.querySelector('label[for="'+el.id+'"]');
      if(lbl) return lbl.textContent.trim().toLowerCase();
    }
    // Check parent label
    var parent = el.closest("label");
    if(parent) return parent.textContent.trim().toLowerCase();
    return "";
  }

  function classifyField(el){
    var tag = el.tagName.toLowerCase();
    if(tag !== "input" && tag !== "textarea" && tag !== "select") return null;

    var type = (el.type || "text").toLowerCase();
    var name = (el.name || "").toLowerCase();
    var id   = (el.id || "").toLowerCase();
    var ph   = (el.placeholder || "").toLowerCase();
    var label = getLabel(el);

    // Skip hidden, submit, button, file, password, checkbox, radio
    if(["hidden","submit","button","file","password","image","reset"].indexOf(type) >= 0) return null;
    if(type === "checkbox" || type === "radio") return null;

    for(var role in FIELD_PATTERNS){
      var patterns = FIELD_PATTERNS[role];
      // Check type
      if(patterns.type && patterns.type.indexOf(type) >= 0) return role;
      // Check name/id
      if(patterns.name){
        for(var i=0;i<patterns.name.length;i++){
          if(patterns.name[i].test(name) || patterns.name[i].test(id)) return role;
        }
      }
      // Check placeholder
      if(patterns.placeholder){
        for(var j=0;j<patterns.placeholder.length;j++){
          if(patterns.placeholder[j].test(ph) || patterns.placeholder[j].test(label)) return role;
        }
      }
    }

    // Fallback: if textarea → message
    if(tag === "textarea") return "message";

    return null;
  }

  function extractFormData(form){
    var data = { _extra: {} };
    var fields = form.querySelectorAll("input, textarea, select");

    for(var i=0; i<fields.length; i++){
      var el = fields[i];
      var val = (el.value || "").trim();
      if(!val) continue;

      var role = classifyField(el);
      if(role && !data[role]){
        data[role] = val;
      } else if(role && data[role]){
        // Already assigned, store as extra
        var key = el.name || el.id || ("field_" + i);
        data._extra[key] = val;
      } else {
        // Unclassified field → store in extras
        var key2 = el.name || el.id || ("field_" + i);
        if(key2 && key2 !== "api_key" && key2 !== "token") {
          data._extra[key2] = val;
        }
      }
    }

    // Merge first_name + last_name if no full name
    if(!data.name && data._extra){
      var fn = data._extra.first_name || data._extra.primeiro_nome || data._extra.fname || "";
      var ln = data._extra.last_name || data._extra.sobrenome || data._extra.lname || "";
      if(fn || ln) data.name = (fn + " " + ln).trim();
    }

    return data;
  }

  // ─── Send to Collector ────────────────────────────────
  function sendLead(formData){
    // Must have at least email or phone
    if(!formData.email && !formData.phone) return;

    var payload = {
      token: TOKEN,
      name: formData.name || null,
      email: formData.email || null,
      phone: formData.phone || null,
      message: formData.message || null,
      utm: getUtm(),
      page: getPageInfo(),
      extra: formData._extra && Object.keys(formData._extra).length ? formData._extra : null,
      ts: Date.now()
    };

    // Use sendBeacon for reliability (fires even on page unload)
    var url = BASE + "/api/collect";
    if(navigator.sendBeacon){
      navigator.sendBeacon(url, JSON.stringify(payload));
    } else {
      var xhr = new XMLHttpRequest();
      xhr.open("POST", url, true);
      xhr.setRequestHeader("Content-Type", "application/json");
      xhr.send(JSON.stringify(payload));
    }
  }

  // ─── Form Interception ────────────────────────────────
  // Use event delegation on document to catch all forms, including dynamically created ones
  document.addEventListener("submit", function(e){
    var form = e.target;
    if(!form || form.tagName !== "FORM") return;

    // Skip forms with data-entur-ignore attribute
    if(form.getAttribute("data-entur-ignore")) return;

    try {
      var data = extractFormData(form);
      sendLead(data);
    } catch(err){
      // Silent fail — never break the host site
    }
  }, true); // capture phase to fire before other handlers

  // ─── AJAX Form Interception (Elementor, etc.) ─────────
  // Some form plugins submit via AJAX without triggering native submit event.
  // We also intercept XHR/fetch to detect form submissions.
  var origXhrSend = XMLHttpRequest.prototype.send;
  var pendingFormData = null;

  // Watch for Elementor-style AJAX form submissions
  document.addEventListener("click", function(e){
    var btn = e.target.closest("button[type=submit], input[type=submit], .elementor-button");
    if(!btn) return;
    var form = btn.closest("form");
    if(!form || form.getAttribute("data-entur-ignore")) return;
    try {
      pendingFormData = extractFormData(form);
    } catch(err){}
  }, true);

  // After any XHR completes, if we had pending form data, send it
  XMLHttpRequest.prototype.send = function(){
    var xhr = this;
    var orig = xhr.onreadystatechange;
    xhr.onreadystatechange = function(){
      if(xhr.readyState === 4 && pendingFormData){
        try { sendLead(pendingFormData); } catch(e){}
        pendingFormData = null;
      }
      if(orig) orig.apply(this, arguments);
    };
    return origXhrSend.apply(this, arguments);
  };

})();`;
}
