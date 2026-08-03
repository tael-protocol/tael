/**
 * Tael product agent embed. Dependency-free; drop on any site:
 *   <script src="https://…/embed.js" data-tael-key="tael_pub_…"></script>
 * Optional: data-tael-base="https://dashboard-origin" (defaults to script origin)
 */
(function () {
  "use strict";

  var script =
    document.currentScript || document.querySelector("script[data-tael-key][src*='embed.js']");
  if (!script) return;

  var key = (script.getAttribute("data-tael-key") || "").trim();
  if (!key) return;

  var baseAttr = (script.getAttribute("data-tael-base") || "").trim().replace(/\/$/, "");
  var base = baseAttr;
  if (!base) {
    try {
      base = new URL(script.src).origin;
    } catch (e) {
      base = window.location.origin;
    }
  }

  var apiRoot = base + "/api/widget/" + encodeURIComponent(key);
  var brand = "#156DFC";
  var agentName = "Assistant";
  var greeting = "";
  var logoUrl = null;

  var host = document.createElement("div");
  host.id = "tael-widget-host";
  host.setAttribute("data-tael", "1");
  document.documentElement.appendChild(host);
  var root = host.attachShadow({ mode: "open" });

  var style = document.createElement("style");
  style.textContent = [
    ":host, * { box-sizing: border-box; }",
    ":host { all: initial; font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif; }",
    ".wrap { position: fixed; z-index: 2147483000; right: 20px; bottom: 20px; display: flex; flex-direction: column; align-items: flex-end; gap: 12px; }",
    ".launcher { width: 56px; height: 56px; border: none; border-radius: 999px; cursor: pointer; color: #fff; display: flex; align-items: center; justify-content: center; box-shadow: 0 8px 24px rgba(15, 23, 42, 0.28); transition: transform 0.15s ease, box-shadow 0.15s ease; }",
    ".launcher:hover { transform: scale(1.04); box-shadow: 0 10px 28px rgba(15, 23, 42, 0.32); }",
    ".launcher:active { transform: scale(0.98); }",
    ".launcher svg { width: 24px; height: 24px; }",
    ".panel { width: min(380px, calc(100vw - 32px)); height: min(560px, calc(100vh - 100px)); background: #0f1115; color: #f4f4f5; border-radius: 18px; overflow: hidden; display: none; flex-direction: column; box-shadow: 0 18px 50px rgba(0,0,0,0.45); border: 1px solid rgba(255,255,255,0.08); }",
    ".panel.open { display: flex; }",
    ".header { display: flex; align-items: center; gap: 10px; padding: 14px 16px; border-bottom: 1px solid rgba(255,255,255,0.08); background: #15171c; }",
    ".logo { width: 32px; height: 32px; border-radius: 10px; object-fit: cover; background: rgba(255,255,255,0.08); flex-shrink: 0; }",
    ".logo.fallback { display: flex; align-items: center; justify-content: center; font-size: 14px; font-weight: 700; color: #fff; }",
    ".title { min-width: 0; flex: 1; }",
    ".title h1 { margin: 0; font-size: 14px; font-weight: 600; color: #fafafa; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }",
    ".title p { margin: 2px 0 0; font-size: 11px; color: rgba(255,255,255,0.45); }",
    ".close { border: none; background: transparent; color: rgba(255,255,255,0.5); cursor: pointer; width: 32px; height: 32px; border-radius: 8px; font-size: 18px; line-height: 1; }",
    ".close:hover { background: rgba(255,255,255,0.08); color: #fff; }",
    ".msgs { flex: 1; overflow-y: auto; padding: 14px; display: flex; flex-direction: column; gap: 10px; }",
    ".bubble { max-width: 85%; padding: 10px 12px; border-radius: 16px; font-size: 13.5px; line-height: 1.45; word-break: break-word; }",
    ".bubble.user { align-self: flex-end; background: #fff; color: #14161a; border-bottom-right-radius: 4px; }",
    ".bubble.assistant { align-self: flex-start; background: #2c2d31; color: #f4f4f5; border-bottom-left-radius: 4px; }",
    ".bubble.meta { align-self: flex-start; background: transparent; color: rgba(255,255,255,0.45); font-size: 12px; padding: 0 2px; }",
    ".bubble strong { font-weight: 600; }",
    ".confirm { align-self: flex-start; width: min(100%, 280px); border: 1px solid rgba(255,255,255,0.1); background: #1c1d21; border-radius: 14px; padding: 12px; }",
    ".confirm .label { margin: 0; font-size: 11px; text-transform: uppercase; letter-spacing: 0.04em; color: rgba(255,255,255,0.4); }",
    ".confirm .name { margin: 4px 0 0; font-size: 13.5px; font-weight: 600; color: #f4f4f5; }",
    ".confirm button { margin-top: 10px; width: 100%; border: none; border-radius: 8px; padding: 8px 12px; font-size: 13px; font-weight: 600; cursor: pointer; color: #14161a; background: #fff; }",
    ".confirm button:hover { background: #f4f4f5; }",
    ".confirm button:disabled { opacity: 0.6; cursor: default; }",
    ".footer { padding: 10px 12px 12px; border-top: 1px solid rgba(255,255,255,0.08); background: #15171c; }",
    ".composer { display: flex; gap: 8px; align-items: flex-end; }",
    ".composer textarea { flex: 1; resize: none; min-height: 40px; max-height: 96px; border-radius: 12px; border: 1px solid rgba(255,255,255,0.1); background: #0f1115; color: #f4f4f5; padding: 10px 12px; font: inherit; font-size: 13.5px; outline: none; }",
    ".composer textarea:focus { border-color: var(--tael-brand, #156DFC); }",
    ".composer button { width: 40px; height: 40px; border: none; border-radius: 12px; cursor: pointer; color: #fff; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }",
    ".composer button:disabled { opacity: 0.5; cursor: default; }",
    ".composer button svg { width: 16px; height: 16px; }",
    ".typing { display: inline-flex; gap: 4px; padding: 4px 0; }",
    ".typing i { width: 6px; height: 6px; border-radius: 999px; background: rgba(255,255,255,0.5); display: block; animation: taelPulse 1s ease-in-out infinite; }",
    ".typing i:nth-child(2) { animation-delay: 0.15s; }",
    ".typing i:nth-child(3) { animation-delay: 0.3s; }",
    "@keyframes taelPulse { 0%, 100% { opacity: 0.25; } 50% { opacity: 1; } }",
    "@media (max-width: 420px) { .wrap { right: 12px; bottom: 12px; } .panel { width: calc(100vw - 24px); height: calc(100vh - 88px); } }",
  ].join("\n");
  root.appendChild(style);

  var wrap = document.createElement("div");
  wrap.className = "wrap";
  wrap.innerHTML = [
    '<div class="panel" part="panel" role="dialog" aria-label="Chat">',
    '  <div class="header">',
    '    <div class="logo fallback" aria-hidden="true">T</div>',
    '    <div class="title"><h1></h1><p>Online</p></div>',
    '    <button type="button" class="close" aria-label="Close">&times;</button>',
    "  </div>",
    '  <div class="msgs" role="log" aria-live="polite"></div>',
    '  <div class="footer"><form class="composer">',
    '    <textarea rows="1" placeholder="Ask a question…" aria-label="Message"></textarea>',
    '    <button type="submit" aria-label="Send" disabled>',
    '      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14"/><path d="M13 6l6 6-6 6"/></svg>',
    "    </button>",
    "  </form></div>",
    "</div>",
    '<button type="button" class="launcher" aria-label="Open chat" aria-expanded="false">',
    '  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4z"/></svg>',
    "</button>",
  ].join("");
  root.appendChild(wrap);

  var panel = wrap.querySelector(".panel");
  var launcher = wrap.querySelector(".launcher");
  var closeBtn = wrap.querySelector(".close");
  var msgs = wrap.querySelector(".msgs");
  var form = wrap.querySelector(".composer");
  var input = wrap.querySelector("textarea");
  var sendBtn = wrap.querySelector(".composer button");
  var titleEl = wrap.querySelector(".title h1");
  var logoEl = wrap.querySelector(".logo");

  var open = false;
  var busy = false;
  var history = [];
  var greeted = false;

  function setBrand(color) {
    brand = color || "#156DFC";
    launcher.style.background = brand;
    sendBtn.style.background = brand;
    wrap.style.setProperty("--tael-brand", brand);
    if (logoEl.classList.contains("fallback")) {
      logoEl.style.background = brand;
    }
  }

  function setOpen(next) {
    open = next;
    panel.classList.toggle("open", open);
    launcher.setAttribute("aria-expanded", open ? "true" : "false");
    launcher.setAttribute("aria-label", open ? "Close chat" : "Open chat");
    if (open) {
      if (!greeted && greeting) {
        appendAssistant(greeting, null);
        greeted = true;
      }
      input.focus();
      scrollBottom();
    }
  }

  function scrollBottom() {
    msgs.scrollTop = msgs.scrollHeight;
  }

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function formatText(s) {
    var escaped = escapeHtml(s);
    return escaped.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>").replace(/\n/g, "<br/>");
  }

  function appendBubble(role, html) {
    var el = document.createElement("div");
    el.className = "bubble " + role;
    el.innerHTML = html;
    msgs.appendChild(el);
    scrollBottom();
    return el;
  }

  function appendAssistant(text, action) {
    appendBubble("assistant", formatText(text || ""));
    if (action) appendConfirm(action);
  }

  function appendConfirm(action) {
    var card = document.createElement("div");
    card.className = "confirm";
    var label = document.createElement("p");
    label.className = "label";
    label.textContent = action.kind === "http" ? "Run action" : "Run capability";
    var name = document.createElement("p");
    name.className = "name";
    name.textContent = action.name || "Action";
    var btn = document.createElement("button");
    btn.type = "button";
    btn.textContent = "Confirm";
    btn.addEventListener("click", function () {
      runAction(action, card, btn);
    });
    card.appendChild(label);
    card.appendChild(name);
    card.appendChild(btn);
    msgs.appendChild(card);
    scrollBottom();
  }

  function setBusy(next) {
    busy = next;
    sendBtn.disabled = busy || !input.value.trim();
    input.disabled = busy;
  }

  function showTyping() {
    var el = document.createElement("div");
    el.className = "bubble assistant";
    el.innerHTML = '<span class="typing" aria-label="Thinking"><i></i><i></i><i></i></span>';
    msgs.appendChild(el);
    scrollBottom();
    return el;
  }

  function applyConfig(cfg) {
    if (!cfg) return;
    agentName = cfg.name || agentName;
    greeting = (cfg.greeting || "").trim();
    logoUrl = cfg.logoUrl || null;
    titleEl.textContent = agentName;
    setBrand(cfg.brandColor);
    if (logoUrl) {
      var img = document.createElement("img");
      img.className = "logo";
      img.alt = "";
      img.src = logoUrl;
      logoEl.replaceWith(img);
      logoEl = img;
    } else {
      logoEl.textContent = (agentName.charAt(0) || "T").toUpperCase();
      logoEl.style.background = brand;
    }
  }

  function loadConfig() {
    return fetch(apiRoot + "/config", { method: "GET", credentials: "omit" })
      .then(function (res) {
        return res.json().then(function (data) {
          if (!res.ok) throw new Error((data && data.error) || "Config failed");
          return data;
        });
      })
      .then(applyConfig)
      .catch(function () {
        titleEl.textContent = agentName;
        setBrand(brand);
        logoEl.textContent = "T";
        logoEl.style.background = brand;
      });
  }

  function sendMessage(text) {
    var content = (text || "").trim();
    if (!content || busy) return;
    appendBubble("user", escapeHtml(content));
    history.push({ role: "user", content: content });
    input.value = "";
    input.style.height = "auto";
    setBusy(true);
    var typing = showTyping();

    fetch(apiRoot + "/chat", {
      method: "POST",
      credentials: "omit",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ messages: history.slice(-20) }),
    })
      .then(function (res) {
        return res.json().then(function (data) {
          return { res: res, data: data };
        });
      })
      .then(function (out) {
        typing.remove();
        if (!out.res.ok) {
          appendBubble(
            "assistant",
            escapeHtml((out.data && out.data.error) || "Something went wrong. Please try again."),
          );
          return;
        }
        var reply = (out.data && out.data.reply) || "";
        var action = out.data && out.data.action ? out.data.action : null;
        if (reply) history.push({ role: "assistant", content: reply });
        appendAssistant(reply || "…", action);
      })
      .catch(function () {
        typing.remove();
        appendBubble("assistant", "Could not reach the agent. Please try again.");
      })
      .then(function () {
        setBusy(false);
        input.focus();
      });
  }

  function runAction(action, card, btn) {
    if (busy) return;
    btn.disabled = true;
    btn.textContent = "Running…";
    setBusy(true);

    var body = { actionId: action.actionId };
    if (action.kind === "http" && action.params) body.params = action.params;
    if (action.kind === "capability" && action.params) body.params = action.params;

    fetch(apiRoot + "/actions/run", {
      method: "POST",
      credentials: "omit",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    })
      .then(function (res) {
        return res.json().then(function (data) {
          return { res: res, data: data };
        });
      })
      .then(function (out) {
        card.remove();
        if (out.res.status === 401 || (out.data && out.data.error === "Not signed in.")) {
          appendBubble(
            "assistant",
            "This action needs the site owner to run it. It is not available to visitors.",
          );
          return;
        }
        if (!out.res.ok || !(out.data && out.data.ok)) {
          appendBubble(
            "assistant",
            escapeHtml(
              (out.data && out.data.error) || "Could not run that action. Please try again.",
            ),
          );
          return;
        }
        var msg = "Ran **" + (action.name || "action") + "**.";
        if (out.data.body) {
          var clipped =
            String(out.data.body).length > 400
              ? String(out.data.body).slice(0, 400) + "…"
              : String(out.data.body);
          msg += "\n\n" + clipped;
        }
        appendAssistant(msg, null);
      })
      .catch(function () {
        btn.disabled = false;
        btn.textContent = "Confirm";
        appendBubble("assistant", "Could not reach the server. Please try again.");
      })
      .then(function () {
        setBusy(false);
      });
  }

  launcher.addEventListener("click", function () {
    setOpen(!open);
  });
  closeBtn.addEventListener("click", function () {
    setOpen(false);
  });

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    sendMessage(input.value);
  });

  input.addEventListener("input", function () {
    sendBtn.disabled = busy || !input.value.trim();
    input.style.height = "auto";
    input.style.height = Math.min(input.scrollHeight, 96) + "px";
  });

  input.addEventListener("keydown", function (e) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input.value);
    }
  });

  setBrand(brand);
  titleEl.textContent = agentName;
  loadConfig();
})();
