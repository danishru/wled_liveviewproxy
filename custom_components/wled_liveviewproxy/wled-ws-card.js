// --- shim: expose LitElement/html/css without imports ---
(() => {
  if (window.LitElement && window.html && window.css) return;
  const probes = [
    "ha-panel-lovelace",
    "hui-view",
    "hui-masonry-view",
    "hui-grid-layout",
    "ha-card",
  ];
  for (const tag of probes) {
    const El = customElements.get(tag);
    if (!El) continue;
    const LitBase = Object.getPrototypeOf(El);
    if (LitBase?.prototype?.render) {
      window.LitElement = window.LitElement || LitBase;
      window.html       = window.html       || LitBase.prototype.html;
      window.css        = window.css        || LitBase.prototype.css;
      break;
    }
  }
  // на очень ранней загрузке могло не найтись — попробуем позднее
  if (!window.LitElement) {
    customElements.whenDefined("ha-panel-lovelace").then(() => {
      const LitBase = Object.getPrototypeOf(customElements.get("ha-panel-lovelace"));
      window.LitElement = window.LitElement || LitBase;
      window.html       = window.html       || LitBase.prototype.html;
      window.css        = window.css        || LitBase.prototype.css;
    });
  }
})();

/* =====================================================================
  Inline action helpers (shared) — tap / hold / double_tap
  ===================================================================== */
  if (!window.__afcActions) (function () {
  const HOLD_MS = 500;

  function fireEvent(el, type, detail = {}, opts = {}) {
    const ev = new CustomEvent(type, {
      detail,
      bubbles: opts.bubbles !== false,
      composed: opts.composed !== false,
      cancelable: !!opts.cancelable,
    });
    el.dispatchEvent(ev);
    return ev;
  }

  function hasAction(cfg) {
    return !!(cfg && cfg.action && cfg.action !== "none");
  }

  function navigatePath(path, replace = false) {
    let p = String(path || "");
    if (!p) return;
    if (!/^[/#?]/.test(p)) p = "/" + p;
    const u = new URL(p, document.baseURI);
    if (replace) history.replaceState(null, "", u.pathname + u.search + u.hash);
    else history.pushState(null, "", u.pathname + u.search + u.hash);
    window.dispatchEvent(new CustomEvent("location-changed", {
      detail: { replace: !!replace }, bubbles: true, composed: true
    }));
  }

  function handleAction(host, hass, baseConfig, gesture) {
    const actionCfg =
      gesture === "hold"       ? (baseConfig.hold_action        || baseConfig.tap_action) :
      gesture === "double_tap" ? (baseConfig.double_tap_action  || baseConfig.tap_action) :
                                  (baseConfig.tap_action         || { action: "more-info" });

    const act = actionCfg?.action || "more-info";
    // важное отличие: используем entity || sensor как целевой eid
    const eid = baseConfig.entity || baseConfig.sensor;

    switch (act) {
      case "more-info": {
        if (eid) fireEvent(host, "hass-more-info", { entityId: eid });
        break;
      }
      case "toggle": {
        if (!eid) break;
        const domain = String(eid).split(".", 1)[0];
        const known = ["light","switch","fan","cover","group","automation","script","input_boolean","climate","lock","media_player"];
        const [srvDomain, srv] = known.includes(domain) ? [domain, "toggle"] : ["homeassistant", "toggle"];
        hass.callService(srvDomain, srv, { entity_id: eid });
        break;
      }
      case "navigate": {
        const path =
          actionCfg.navigation_path ??
          actionCfg.path ??
          actionCfg.navigationPath;
        if (!path) break;
        navigatePath(path, !!actionCfg.navigation_replace);
        break;
      }
      case "url": {
        const url = actionCfg.url_path;
        const tab = actionCfg.new_tab ? "_blank" : "_self";
        if (url) window.open(url, tab, "noopener");
        break;
      }
      case "call-service": {
        const svc = actionCfg.service; // "domain.service"
        if (!svc) break;
        const [d, s] = String(svc).split(".", 2);
        const data = actionCfg.service_data || actionCfg.data || {};
        if (d && s) hass.callService(d, s, data);
        break;
      }
      case "perform-action": {
        const actId = actionCfg.perform_action || actionCfg.service;
        if (!actId) break;
        const [domain, service] = String(actId).split(".", 2);
        if (!domain || !service) break;
        const data   = actionCfg.data   || {};
        const target = actionCfg.target || {};
        const payload = { ...data, ...target };
        const confirm = actionCfg.confirmation;
        if (confirm) {
          const text = typeof confirm === "object" && confirm.text ? String(confirm.text) : undefined;
          if (!window.confirm(text || "Are you sure?")) break;
        }
        hass.callService(domain, service, payload);
        break;
      }
      default: break;
    }
  }

  function findScrollParent(el) {
    let cur = el;
    while (cur && cur !== document.body && cur !== document.documentElement) {
      const cs = getComputedStyle(cur);
      const canX = (cs.overflowX === "auto" || cs.overflowX === "scroll" || cs.overflow === "auto" || cs.overflow === "scroll") && cur.scrollWidth > cur.clientWidth;
      const canY = (cs.overflowY === "auto" || cs.overflowY === "scroll" || cs.overflow === "auto" || cs.overflow === "scroll") && cur.scrollHeight > cur.clientHeight;
      if (canX || canY) return cur;
      cur = cur.parentElement;
    }
    return null;
  }

  function bindAction(target, options, onGesture) {
    if (!target || target.__afcActionBound) return;
    target.__afcActionBound = true;

    const MOVE_TOL = 12; // px
    if (!target.style.touchAction) target.style.touchAction = "manipulation";

    let held = false, moved = false, holdTimer = null, dblTimer = null;
    let startX = 0, startY = 0, activeId = null;

    let scroller = null, startSL = 0, startST = 0;
    let onScroll = null, onWheel = null;

    const clearHold = () => { clearTimeout(holdTimer); holdTimer = null; };
    const detachScrollWatch = () => {
      if (scroller && onScroll) scroller.removeEventListener("scroll", onScroll, { passive: true });
      if (scroller && onWheel)  scroller.removeEventListener("wheel",  onWheel,  { passive: true });
      scroller = null; onScroll = null; onWheel = null;
    };
    const reset = () => { detachScrollWatch(); clearHold(); held = moved = false; activeId = null; };

    const onDown = (ev) => {
      if (ev.button != null && ev.button !== 0) return;
      activeId = ev.pointerId ?? 1;
      held = moved = false; startX = ev.clientX; startY = ev.clientY;

      scroller = findScrollParent(ev.target || target);
      if (scroller) {
        startSL = scroller.scrollLeft; startST = scroller.scrollTop;
        onScroll = () => {
          if (activeId == null) return;
          if (Math.abs(scroller.scrollLeft - startSL) > 1 || Math.abs(scroller.scrollTop - startST) > 1) {
            moved = true; clearHold();
          }
        };
        onWheel = () => { if (activeId == null) return; moved = true; clearHold(); };
        scroller.addEventListener("scroll", onScroll, { passive: true });
        scroller.addEventListener("wheel",  onWheel,  { passive: true });
      }

      clearHold();
      holdTimer = window.setTimeout(() => { held = true; }, HOLD_MS);
    };

    const onMove = (ev) => {
      if (activeId == null || ev.pointerId !== activeId || moved) return;
      const dx = Math.abs(ev.clientX - startX);
      const dy = Math.abs(ev.clientY - startY);
      if (dx > MOVE_TOL || dy > MOVE_TOL) { moved = true; clearHold(); }
    };

    const finishTapLike = (ev) => {
      if (held) { onGesture("hold", ev); return; }
      if (options?.hasDoubleClick) {
        if (dblTimer) { clearTimeout(dblTimer); dblTimer = null; onGesture("double_tap", ev); }
        else {
          dblTimer = window.setTimeout(() => { dblTimer = null; onGesture("tap", ev); }, 250);
        }
      } else onGesture("tap", ev);
    };

    const onUp = (ev) => {
      if (activeId == null || ev.pointerId !== activeId) return;
      clearHold();
      if (!moved) finishTapLike(ev);
      reset();
    };

    const onCancel = () => { reset(); };

    target.addEventListener("pointerdown",  onDown,   { passive: true });
    target.addEventListener("pointermove",  onMove,   { passive: true });
    target.addEventListener("pointerup",    onUp);
    target.addEventListener("pointercancel", onCancel);
    target.addEventListener("keyup", (e) => {
      if (e.key === "Enter" || e.keyCode === 13) onGesture("tap", e);
    });
  }

  window.__afcActions = { fireEvent, hasAction, handleAction, bindAction };
})();


// ===== Version banner (one-time) =====
const WLVP_VERSION = "0.2.3";
const WLVP_BADGE   = "background:#ff8a00;color:#fff;padding:2px 10px;border-radius:9999px;font-weight:600;letter-spacing:.2px;";
const WLVP_TEXT    = "color:#ff8a00;font-weight:700;padding-left:6px;";

if (!window.__WLVP_VERSION_LOGGED) {
  window.__WLVP_VERSION_LOGGED = true;
  console.info("%c💡🌈  WLED Live View Card%c v" + WLVP_VERSION, WLVP_BADGE, WLVP_TEXT);
}

const mdipathIcons = {
  // MDI paths (скопируй из @mdi/js) https://raw.githubusercontent.com/Templarian/MaterialDesign-JS/refs/heads/master/mdi.js
  "mdiGestureTap": "M10,9A1,1 0 0,1 11,8A1,1 0 0,1 12,9V13.47L13.21,13.6L18.15,15.79C18.68,16.03 19,16.56 19,17.14V21.5C18.97,22.32 18.32,22.97 17.5,23H11C10.62,23 10.26,22.85 10,22.57L5.1,18.37L5.84,17.6C6.03,17.39 6.3,17.28 6.58,17.28H6.8L10,19V9M11,5A4,4 0 0,1 15,9C15,10.5 14.2,11.77 13,12.46V11.24C13.61,10.69 14,9.89 14,9A3,3 0 0,0 11,6A3,3 0 0,0 8,9C8,9.89 8.39,10.69 9,11.24V12.46C7.8,11.77 7,10.5 7,9A4,4 0 0,1 11,5Z",
  "mdiTextShort": "M4,9H20V11H4V9M4,13H14V15H4V13Z",
  "mdiTuneVariant": "M8 13C6.14 13 4.59 14.28 4.14 16H2V18H4.14C4.59 19.72 6.14 21 8 21S11.41 19.72 11.86 18H22V16H11.86C11.41 14.28 9.86 13 8 13M8 19C6.9 19 6 18.1 6 17C6 15.9 6.9 15 8 15S10 15.9 10 17C10 18.1 9.1 19 8 19M19.86 6C19.41 4.28 17.86 3 16 3S12.59 4.28 12.14 6H2V8H12.14C12.59 9.72 14.14 11 16 11S19.41 9.72 19.86 8H22V6H19.86M16 9C14.9 9 14 8.1 14 7C14 5.9 14.9 5 16 5S18 5.9 18 7C18 8.1 17.1 9 16 9Z",
};
const iconPath = (mdi, fallbackKey = "mdiTextShort") =>
  mdipathIcons[mdi] || mdipathIcons[fallbackKey];

// ======================================================================
// Основной класс карточки
// ======================================================================
class WledWsCard extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this.ws = null;
    this._heartbeatInterval = null;
    this._observer = null;
    this.initialized = false;
  }

  // Геттер для доступа к Home Assistant
  get hass() {
    return this._hass;
  }

  // Сеттер для hass
  set hass(hass) {
    this._hass = hass;
    // Если конфигурация не задана или содержит wildcard, подставляем первую найденную сущность с префиксом "sensor.wlvp_"
    if (!this.config.sensor || this.config.sensor.includes('*')) {
      const matchingSensor = Object.keys(hass.states).find(
        (entityId) => entityId.startsWith("sensor.wlvp_")
      );
      if (matchingSensor) {
        this.config.sensor = matchingSensor;
        if (this.config.info) {
          console.log("wled-ws-card: Wildcard sensor substituted:", matchingSensor);
        }
      }
    }
    if (this.config.sensor && hass.states[this.config.sensor]) {
      const sensorState = hass.states[this.config.sensor];
      if (sensorState.attributes && sensorState.attributes.entry_id) {
        if (this.config.entry_id !== sensorState.attributes.entry_id) {
          this.config.entry_id = sensorState.attributes.entry_id;
          if (this.config.info) {
            console.log("wled-ws-card: entry_id extracted from sensor:", this.config.entry_id);
          }
        }
      }
    }
    if (this.shadowRoot) this._setupInteractions();
  }

  setConfig(config) {
    if (!config) {
      throw new Error("wled-ws-card: Invalid configuration");
    }
    // Создаем копию конфигурации
    this.config = Object.assign({}, config);
    if (!this.config.tap_action)        this.config.tap_action        = { action: "more-info" };
    // Если переключатель info не задан, устанавливаем false
    if (this.config.info === undefined) {
      this.config.info = false;
    }
    if (this.config.info) {
      console.log("wled-ws-card: config =", this.config);
    }
    if (this.config.sensor) {
      if (this.hass && this.hass.states && this.hass.states[this.config.sensor]) {
        const sensorState = this.hass.states[this.config.sensor];
        if (sensorState.attributes && sensorState.attributes.entry_id) {
          this.config.entry_id = sensorState.attributes.entry_id;
          if (this.config.info) {
            console.log("wled-ws-card: entry_id extracted from sensor:", this.config.entry_id);
          }
        } else {
          if (this.config.info) {
            console.warn("wled-ws-card: entry_id not found in sensor attributes, using 'default'");
          }
          this.config.entry_id = "default";
        }
      } else {
        if (this.config.info) {
          console.warn("wled-ws-card: Sensor not found, using 'default'");
        }
        this.config.entry_id = "default";
      }
    } else if (!this.config.entry_id) {
      if (this.config.info) {
        console.warn("wled-ws-card: Neither sensor nor entry_id specified, using 'default'");
      }
      this.config.entry_id = "default";
    }
    // Если яркость не задана, используем 100%
    if (!this.config.brightness) {
      this.config.brightness = 100;
    }
    // Если угол не задан, устанавливаем по умолчанию 90°
    if (this.config.angle === undefined || this.config.angle === null) {
      this.config.angle = 90;
    }
    this.initialized = true;
  }

  connectedCallback() {
    if (!this.initialized) {
      this.setConfig({});
    }
    this.render();
    this._setupObserver();
    this._setupInteractions();
  }

  // Привязка жестов и запуск действий
  _setupInteractions() {
    const helpers = window.__afcActions;
    if (!helpers) return;
  
    const { hasAction, bindAction, handleAction } = helpers;
    const el = this.shadowRoot && this.shadowRoot.getElementById("card");
    if (!el) return;
  
    // если нет явных экшенов, но есть entity/sensor — считаем, что tap = more-info по умолчанию
    const wantsDefault = !!(this.config?.entity || this.config?.sensor);
    const hasAny =
      hasAction(this.config.tap_action) ||
      hasAction(this.config.hold_action) ||
      hasAction(this.config.double_tap_action) ||
      wantsDefault;
  
    if (!hasAny) return;
  
    el.setAttribute("role", "button");
    el.setAttribute("tabindex", "0");
    el.style.cursor = "pointer";
  
    bindAction(el, { hasDoubleClick: hasAction(this.config.double_tap_action) }, (type, ev) => {
      const baseCfg = { ...this.config, entity: this.config.entity || this.config.sensor };
      handleAction(this, this.hass, baseCfg, type);
    });
  }  

  disconnectedCallback() {
    if (this._heartbeatInterval) {
      clearInterval(this._heartbeatInterval);
      this._heartbeatInterval = null;
    }
    if (this.ws) {
      this.ws.close();
    }
    if (this._observer) {
      this._observer.disconnect();
      this._observer = null;
    }
  }

  _setupObserver() {
    if (!("IntersectionObserver" in window)) {
      this._connectWebSocket();
      return;
    }
    this._observer = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          if (this.config.info) {
            console.log("wled-ws-card: Card is visible. Establishing WebSocket connection.");
          }
          this._connectWebSocket();
          this._observer.disconnect();
          this._observer = null;
        }
      });
    }, { threshold: 0.1 });
    this._observer.observe(this);
  }

  _connectWebSocket() {
    const entryId = encodeURIComponent(this.config.entry_id);
    // Здесь угол используется только на стороне клиента при формировании итогового CSS.
    const protocol = window.location.protocol === "https:" ? "wss" : "ws";
    const url = `${protocol}://${window.location.host}/api/wled_ws/${entryId}`;
    if (this.config.info) {
      console.log("wled-ws-card: Connecting to WebSocket at", url);
    }
    this.ws = new WebSocket(url);
    this.ws.onopen = () => {
      if (this.config.info) {
        console.log("wled-ws-card: WebSocket connected");
      }
    };
    this.ws.onmessage = (event) => {
      this.handleMessage(event.data);
    };
    this.ws.onclose = () => {
      if (this.config.info) {
        console.log("wled-ws-card: WebSocket disconnected");
      }
    };
    this.ws.onerror = (error) => {
      if (this.config.info) {
        console.error("wled-ws-card: WebSocket error", error);
      }
    };

    if (!this._heartbeatInterval) {
      this._heartbeatInterval = setInterval(() => {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
          this.ws.send("heartbeat");
          if (this.config.info) {
            console.log("wled-ws-card: Sent heartbeat");
          }
        }
      }, 30000);
    }
  }

  handleMessage(data) {
    if (this.config.debug) {
      console.log("wled-ws-card: Received data:", data);
    }
    const cardEl = this.shadowRoot.getElementById('card');
    if (cardEl) {
      // Здесь сервер возвращает только цвета, а угол формируется на стороне карточки.
      // Если в конфигурации задан angle (0..360), используем его, иначе по умолчанию 90.
      const angle = (this.config.angle !== undefined && this.config.angle !== null)
        ? this.config.angle : 90;
      cardEl.style.background = `linear-gradient(${angle}deg, ${data})`;
    }
  }

  render() {
    const brightness = this.config.brightness;
    this.shadowRoot.innerHTML = `
        <style>
          :host {
            --card-brightness: ${brightness}%;
          }
          ha-card {
            width: 100%;
            height: 100%;
            border-radius: var(--ha-card-border-radius, 8px);
            overflow: hidden;
          }
          .card-content {
            width: 100%;
            height: 100%;
            box-sizing: border-box;
            filter: brightness(var(--card-brightness, 100%));
          }
        </style>
        <ha-card>
          <div class="card-content" id="card"></div>
        </ha-card>
    `;
  }

  getCardSize() {
    return 1;
  }

  getGridOptions() {
    return {
      rows: 1,
      columns: 12,
    };
  }

  static getConfigElement() {
    return document.createElement("wled-ws-card-editor");
  }

  static getStubConfig() {
    return {
      sensor: "",
      debug: false,
      info: false,
      brightness: 100,
      angle: 90
    };
  }
}

customElements.define('wled-ws-card', WledWsCard);

window.customCards = window.customCards || [];
window.customCards.push({
  type: "wled-ws-card",
  name: "WLED Live View Card",
  preview: true,
  description: "Card for displaying live view from WLED via WebSocket.",
  documentationURL: "https://github.com/danishru/wled_liveviewproxy/?tab=readme-ov-file"
});

// ======================================================================
// WledWsCardEditor — schema-based редактор (ha-form) + Expandable Interactions
// ======================================================================

class WledWsCardEditor extends LitElement {
  static get properties() {
    return {
      _config:  { type: Object },
      hass:     { type: Object },
      _helpers: { type: Object },
    };
  }

  constructor() {
    super();
    this._config = {
      sensor: "",
      brightness: 100,
      angle: 90,
      info: false,
      debug: false,
      tap_action: { action: "more-info" },
    };
  }

  setConfig(config) {
    this._config = {
      sensor: "",
      brightness: 100,
      angle: 90,
      info: false,
      debug: false,
      tap_action: { action: "more-info" },
      ...config,
    };
  }

  _getWledSensors() {
    if (!this.hass) return [];
    return Object.keys(this.hass.states)
      .filter(
        (entityId) =>
          entityId.startsWith("sensor.wlvp_") &&
          this.hass.states[entityId]?.attributes?.entry_id !== undefined
      )
      .sort();
  }

  _computeLabelCallback = (schema) => {
    if (!this.hass) return;

    switch (schema.name) {
      case "sensor":
      return this.hass.localize(`ui.panel.lovelace.editor.card.generic.entity`);
      case "brightness":
        return "Card Brightness (%)";
      case "angle":
        return "Gradient Angle (degrees)";
      case "info":
        return "Info Mode";
      case "debug":
        return "Debug Mode";
      // Поле "name"
      case "name":
        return this.hass.localize(
          "ui.panel.lovelace.editor.card.generic.name"
        );
      case "icon_tap_action":
      case "icon_hold_action":
      case "icon_double_tap_action":
        return this.hass.localize(`ui.panel.lovelace.editor.card.tile.${schema.name}`);
        
      case "tap_action":
      case "hold_action":
      case "double_tap_action":
        return this.hass.localize(`ui.panel.lovelace.editor.card.generic.${schema.name}`);          

      // Фоллбек — generic для любого другого поля
      default:
        return this.hass.localize(
          `ui.panel.lovelace.editor.card.generic.${schema.name}`
        ) || schema.label || schema.name;
    }
  };

  _valueChanged = (ev) => {
    let next = { ...this._config, ...ev.detail.value };
  
    if ("brightness" in ev.detail.value) {
      const b = Number(next.brightness);
      next.brightness = Number.isFinite(b) ? Math.min(1000, Math.max(0, b)) : 100;
    }
    if ("angle" in ev.detail.value) {
      const a = Number(next.angle);
      next.angle = Number.isFinite(a) ? ((a % 360) + 360) % 360 : 90;
    }
  
    // ключевая очистка: не храним пустые опциональные действия
    if (next.hold_action?.action === "none") delete next.hold_action;
    if (next.double_tap_action?.action === "none") delete next.double_tap_action;
  
    this._config = next;
    this.dispatchEvent(new CustomEvent("config-changed", {
      detail: { config: next }, bubbles: true, composed: true
    }));
  };  

  async firstUpdated() {
    try {
      this._helpers = await window.loadCardHelpers();
    } catch (_) {}
  }

  static get styles() {
    return css`.wrap{padding:16px}`;
  }

  render() {
    if (!this.hass) return html``;

    const sensors = this._getWledSensors();

    const baseSchema = [
      {
        name: "sensor",
        required: true,
        selector: { entity: { include_entities: sensors } },
      },
      {
        type: "grid",
        columns: 2,            // ← без name
        schema: [
          {
            name: "brightness",
            selector: { number: { min: 0, max: 1000, step: 1, mode: "box" } },
            default: this._config.brightness ?? 100,
          },
          {
            name: "angle",
            selector: { number: { min: 0, max: 360, step: 1, mode: "box" } },
            default: this._config.angle ?? 90,
          },
        ],
      },
    ];    
    
    const schema = [
      ...baseSchema,
      {
        name: "interactions",
        type: "expandable",
        iconPath: iconPath?.("mdiGestureTap"),
        flatten: true,
        schema: [
          { name: "tap_action",
            selector: { ui_action: { default_action: "more-info" } },
            default: this._config.tap_action ?? { action: "more-info" } },
    
          { // вот этот блок показывает кнопку «Добавить действие»
            name: "",
            type: "optional_actions",
            flatten: true,
            schema: [
              { name: "hold_action",       selector: { ui_action: { default_action: "none" } } },
              { name: "double_tap_action", selector: { ui_action: { default_action: "none" } } },
            ],
          },
        ],
      },
      /* -------- НОВЫЙ раскрывающийся раздел “Доп.-настройки” -------- */
      {
        name: "advanced_options",
        label: "Advanced options",
        type: "expandable",
        iconPath: iconPath?.("mdiTuneVariant"),
        flatten: true,
        schema: [
          {
            type: "grid",
            columns: 2,     // ← без name
            schema: [
              { name: "info",  selector: { boolean: {} }, default: !!this._config.info  },
              { name: "debug", selector: { boolean: {} }, default: !!this._config.debug },
            ],
          },
        ],
      }
    ];

    return html`
      <div class="wrap">
        <ha-form
          .hass=${this.hass}
          .data=${this._config}
          .schema=${schema}
          .computeLabel=${this._computeLabelCallback}
          @value-changed=${this._valueChanged}
        ></ha-form>
      </div>
    `;
  }
}

customElements.define("wled-ws-card-editor", WledWsCardEditor);