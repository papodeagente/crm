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
 *   6. Intercepts AJAX submissions (jQuery.ajax, XHR, fetch) for plugins
 *      that prevent the native submit event (Elementor Pro, WPForms, etc.)
 */

export function generateTrackerScript(token: string, baseUrl: string): string {
  return `(function(){
  "use strict";
  if(window.__entur_tracker_loaded) return;
  window.__entur_tracker_loaded = true;

  var TOKEN = "${token}";
  var BASE  = "${baseUrl}";
  var SENT_FORMS = {}; // Dedup: prevent double-sending the same form within 5s

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
    if(el.id){
      var lbl = document.querySelector('label[for="'+el.id+'"]');
      if(lbl) return lbl.textContent.trim().toLowerCase();
    }
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
      if(patterns.type && patterns.type.indexOf(type) >= 0) return role;
      if(patterns.name){
        for(var i=0;i<patterns.name.length;i++){
          if(patterns.name[i].test(name) || patterns.name[i].test(id)) return role;
        }
      }
      if(patterns.placeholder){
        for(var j=0;j<patterns.placeholder.length;j++){
          if(patterns.placeholder[j].test(ph) || patterns.placeholder[j].test(label)) return role;
        }
      }
    }

    if(tag === "textarea") return "message";
    return null;
  }

  // ─── Elementor-specific field extraction ──────────────
  // Elementor uses form_fields[name], form_fields[email], etc.
  // These are hidden from our heuristic because the name is "form_fields[xxx]"
  // We need to also check the bracket content
  function classifyElementorField(el){
    var name = (el.name || "");
    var match = name.match(/form_fields\\[([^\\]]+)\\]/);
    if(!match) return classifyField(el);

    var fieldKey = match[1].toLowerCase();
    // Direct mapping for Elementor field keys
    if(/^e-?mail$/.test(fieldKey)) return "email";
    if(/^(phone|tel|fone|celular|whatsapp|wpp|mobile|telefone)$/.test(fieldKey)) return "phone";
    if(/^(name|nome|full_?name|nome_?completo|first_?name|primeiro_?nome)$/.test(fieldKey)) return "name";
    if(/^(message|mensagem|comment|descri|observa|assunto|subject)$/.test(fieldKey)) return "message";

    // Also check by input type
    var type = (el.type || "text").toLowerCase();
    if(type === "email") return "email";
    if(type === "tel") return "phone";

    // Also check by id
    var id = (el.id || "").toLowerCase();
    if(/email/.test(id)) return "email";
    if(/phone|tel|fone|celular|whatsapp|wpp|telefone/.test(id)) return "phone";
    if(/^form-field-name$/.test(id) || /^form-field-nome$/.test(id)) return "name";

    // Fallback to standard heuristic
    return classifyField(el);
  }

  function extractFormData(form){
    var data = { _extra: {} };
    var fields = form.querySelectorAll("input, textarea, select");
    var isElementor = form.classList.contains("elementor-form") ||
                      form.querySelector('[name^="form_fields"]') !== null;

    for(var i=0; i<fields.length; i++){
      var el = fields[i];
      var val = (el.value || "").trim();
      if(!val) continue;

      // Skip truly hidden system fields
      var type = (el.type || "").toLowerCase();
      var name = (el.name || "").toLowerCase();
      if(type === "hidden" && (
        /^(post_id|form_id|referer_title|queried_id|action|_wpnonce|_wp_http_referer)$/.test(name) ||
        /^(nonce|security|honeypot)$/.test(name)
      )) continue;

      var role = isElementor ? classifyElementorField(el) : classifyField(el);

      if(role && !data[role]){
        data[role] = val;
      } else if(role && data[role]){
        var key = el.name || el.id || ("field_" + i);
        data._extra[key] = val;
      } else {
        // Check if it's a hidden UTM field from Elementor
        if(type === "hidden"){
          var utmMatch = name.match(/form_fields\\[(utm_[^\\]]+)\\]/);
          if(utmMatch && val){
            data._extra[utmMatch[1]] = val;
            continue;
          }
        }
        // Unclassified visible field → store in extras
        if(type !== "hidden"){
          var key2 = el.name || el.id || ("field_" + i);
          if(key2 && key2 !== "api_key" && key2 !== "token") {
            data._extra[key2] = val;
          }
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

  // ─── Dedup & Send ─────────────────────────────────────
  function formFingerprint(formData){
    return (formData.email || "") + "|" + (formData.phone || "") + "|" + (formData.name || "");
  }

  function sendLead(formData){
    if(!formData.email && !formData.phone) return;

    // Dedup: don't send the same data twice within 5 seconds
    var fp = formFingerprint(formData);
    var now = Date.now();
    if(SENT_FORMS[fp] && (now - SENT_FORMS[fp]) < 5000) return;
    SENT_FORMS[fp] = now;

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

  // ─── Strategy 1: Native submit event ──────────────────
  document.addEventListener("submit", function(e){
    var form = e.target;
    if(!form || form.tagName !== "FORM") return;
    if(form.getAttribute("data-entur-ignore")) return;
    try {
      var data = extractFormData(form);
      sendLead(data);
    } catch(err){}
  }, true);

  // ─── Strategy 2: Elementor Pro submit_success event ───
  // Elementor Pro fires a jQuery "submit_success" event on the form
  // after a successful AJAX submission. This is the most reliable
  // way to capture Elementor form data.
  function hookElementorEvents(){
    if(typeof jQuery === "undefined" && typeof $ === "undefined") return;
    var jq = typeof jQuery !== "undefined" ? jQuery : $;
    try {
      jq(document).on("submit_success", ".elementor-form", function(e){
        try {
          var form = e.target;
          if(!form) return;
          var data = extractFormData(form);
          sendLead(data);
        } catch(err){}
      });
    } catch(err){}
  }

  // ─── Strategy 3: jQuery AJAX interceptor ──────────────
  // Many WordPress plugins use jQuery.ajax. We intercept it to
  // detect form submissions (action=elementor_pro_forms_send_form,
  // action=wpforms_submit, etc.)
  function hookJQueryAjax(){
    if(typeof jQuery === "undefined" && typeof $ === "undefined") return;
    var jq = typeof jQuery !== "undefined" ? jQuery : $;
    try {
      jq(document).ajaxComplete(function(event, xhr, settings){
        if(!settings || !settings.data) return;
        var dataStr = typeof settings.data === "string" ? settings.data : "";
        // Check if this is a form submission AJAX call
        var isFormSubmit = (
          dataStr.indexOf("elementor_pro_forms_send_form") >= 0 ||
          dataStr.indexOf("wpforms_submit") >= 0 ||
          dataStr.indexOf("gform_submit") >= 0 ||
          dataStr.indexOf("cf7") >= 0 ||
          dataStr.indexOf("fluentform") >= 0 ||
          dataStr.indexOf("forminator_submit") >= 0 ||
          dataStr.indexOf("form_id") >= 0
        );
        if(!isFormSubmit) return;

        // Try to find the form that was submitted
        // Parse the AJAX data to extract form fields
        try {
          var params = new URLSearchParams(dataStr);
          var formData = { _extra: {} };

          params.forEach(function(value, key){
            if(!value) return;
            var fieldMatch = key.match(/form_fields\\[([^\\]]+)\\]/);
            if(fieldMatch){
              var fieldKey = fieldMatch[1].toLowerCase();
              if(/^e-?mail$/.test(fieldKey) && !formData.email) formData.email = value;
              else if(/^(phone|tel|fone|celular|whatsapp|wpp|mobile|telefone)$/.test(fieldKey) && !formData.phone) formData.phone = value;
              else if(/^(name|nome|full_?name|nome_?completo|first_?name|primeiro_?nome)$/.test(fieldKey) && !formData.name) formData.name = value;
              else if(/^(message|mensagem|comment|descri|observa|assunto|subject)$/.test(fieldKey) && !formData.message) formData.message = value;
              else if(/^utm_/.test(fieldKey)) formData._extra[fieldKey] = value;
              else formData._extra[fieldKey] = value;
            }
            // WPForms style: wpforms[fields][1]
            var wpMatch = key.match(/wpforms\\[fields\\]\\[([^\\]]+)\\]/);
            if(wpMatch && value){
              // WPForms doesn't use semantic keys, store all and let heuristic work
              formData._extra["wpfield_" + wpMatch[1]] = value;
            }
          });

          // Also try to extract from the form element in the DOM if we found one
          if(!formData.email && !formData.phone){
            // Try to find the most recently interacted form
            var forms = document.querySelectorAll("form.elementor-form, form.wpforms-form, form.gform_wrapper form");
            for(var i = forms.length - 1; i >= 0; i--){
              var domData = extractFormData(forms[i]);
              if(domData.email || domData.phone){
                formData = domData;
                break;
              }
            }
          }

          sendLead(formData);
        } catch(err){}
      });
    } catch(err){}
  }

  // ─── Strategy 4: XHR interceptor (fallback) ───────────
  // For sites without jQuery, intercept raw XMLHttpRequest
  var origXhrOpen = XMLHttpRequest.prototype.open;
  var origXhrSend = XMLHttpRequest.prototype.send;

  XMLHttpRequest.prototype.open = function(method, url){
    this._enturUrl = url;
    this._enturMethod = method;
    return origXhrOpen.apply(this, arguments);
  };

  XMLHttpRequest.prototype.send = function(body){
    var xhr = this;
    var url = xhr._enturUrl || "";

    // Only intercept POST requests to admin-ajax.php or form endpoints
    if(xhr._enturMethod === "POST" && typeof body === "string" && (
      url.indexOf("admin-ajax.php") >= 0 ||
      url.indexOf("wp-json") >= 0 ||
      url.indexOf("form") >= 0
    )){
      var isFormSubmit = (
        body.indexOf("elementor_pro_forms_send_form") >= 0 ||
        body.indexOf("wpforms_submit") >= 0 ||
        body.indexOf("form_fields") >= 0 ||
        body.indexOf("form_id") >= 0
      );

      if(isFormSubmit){
        try {
          var params = new URLSearchParams(body);
          var formData = { _extra: {} };
          params.forEach(function(value, key){
            if(!value) return;
            var fm = key.match(/form_fields\\[([^\\]]+)\\]/);
            if(fm){
              var fk = fm[1].toLowerCase();
              if(/^e-?mail$/.test(fk) && !formData.email) formData.email = value;
              else if(/^(phone|tel|fone|celular|whatsapp|wpp|mobile|telefone)$/.test(fk) && !formData.phone) formData.phone = value;
              else if(/^(name|nome|full_?name|nome_?completo|first_?name|primeiro_?nome)$/.test(fk) && !formData.name) formData.name = value;
              else if(/^(message|mensagem|comment|descri|observa|assunto|subject)$/.test(fk) && !formData.message) formData.message = value;
              else formData._extra[fk] = value;
            }
          });
          sendLead(formData);
        } catch(err){}
      }
    }

    return origXhrSend.apply(this, arguments);
  };

  // ─── Strategy 5: Fetch interceptor ────────────────────
  var origFetch = window.fetch;
  if(origFetch){
    window.fetch = function(input, init){
      try {
        var url = typeof input === "string" ? input : (input && input.url ? input.url : "");
        var method = (init && init.method) ? init.method.toUpperCase() : "GET";
        var body = init && init.body ? init.body : null;

        if(method === "POST" && typeof body === "string" && (
          url.indexOf("admin-ajax.php") >= 0 ||
          url.indexOf("form") >= 0
        )){
          var isFormSubmit = (
            body.indexOf("form_fields") >= 0 ||
            body.indexOf("form_id") >= 0
          );
          if(isFormSubmit){
            try {
              var params = new URLSearchParams(body);
              var formData = { _extra: {} };
              params.forEach(function(value, key){
                if(!value) return;
                var fm = key.match(/form_fields\\[([^\\]]+)\\]/);
                if(fm){
                  var fk = fm[1].toLowerCase();
                  if(/^e-?mail$/.test(fk) && !formData.email) formData.email = value;
                  else if(/^(phone|tel|fone|celular|whatsapp|wpp|mobile|telefone)$/.test(fk) && !formData.phone) formData.phone = value;
                  else if(/^(name|nome|full_?name|nome_?completo|first_?name|primeiro_?nome)$/.test(fk) && !formData.name) formData.name = value;
                  else if(/^(message|mensagem|comment|descri|observa|assunto|subject)$/.test(fk) && !formData.message) formData.message = value;
                  else formData._extra[fk] = value;
                }
              });
              sendLead(formData);
            } catch(err){}
          }
        }
      } catch(err){}
      return origFetch.apply(this, arguments);
    };
  }

  // ─── Strategy 6: MutationObserver for dynamic forms ───
  // Watch for forms added to the DOM (popups, modals, lazy-loaded sections)
  // and also watch for Elementor success messages to capture data
  var observer = new MutationObserver(function(mutations){
    for(var i = 0; i < mutations.length; i++){
      var nodes = mutations[i].addedNodes;
      for(var j = 0; j < nodes.length; j++){
        var node = nodes[j];
        if(node.nodeType !== 1) continue;

        // Check if a success message was added (Elementor shows .elementor-message-success)
        if(node.classList && node.classList.contains("elementor-message") &&
           node.classList.contains("elementor-message-success")){
          // The form was submitted successfully, try to extract data from the parent form
          var parentForm = node.closest("form");
          if(parentForm){
            try {
              var data = extractFormData(parentForm);
              sendLead(data);
            } catch(err){}
          }
        }

        // Also check children for success messages
        if(node.querySelectorAll){
          var successMsgs = node.querySelectorAll(".elementor-message-success");
          for(var k = 0; k < successMsgs.length; k++){
            var pf = successMsgs[k].closest("form");
            if(pf){
              try {
                var d = extractFormData(pf);
                sendLead(d);
              } catch(err){}
            }
          }
        }
      }
    }
  });
  observer.observe(document.body || document.documentElement, {
    childList: true,
    subtree: true
  });

  // ─── Initialize hooks ─────────────────────────────────
  // Hook jQuery events when jQuery is available
  // jQuery might load after our script, so we retry
  function initHooks(){
    hookElementorEvents();
    hookJQueryAjax();
  }

  // Try immediately
  if(document.readyState === "complete" || document.readyState === "interactive"){
    setTimeout(initHooks, 100);
  }
  // Also try on DOMContentLoaded and load
  document.addEventListener("DOMContentLoaded", function(){ setTimeout(initHooks, 100); });
  window.addEventListener("load", function(){ setTimeout(initHooks, 500); });
  // Final retry for late-loading jQuery
  setTimeout(initHooks, 2000);
  setTimeout(initHooks, 5000);

})();`;
}
