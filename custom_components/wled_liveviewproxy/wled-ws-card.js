import { LitElement, html, css } from 'https://cdn.skypack.dev/lit?min';

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
  }

  setConfig(config) {
    if (!config) {
      throw new Error("wled-ws-card: Invalid configuration");
    }
    // Создаем копию конфигурации
    this.config = Object.assign({}, config);
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
    this.initialized = true;
  }

  connectedCallback() {
    if (!this.initialized) {
      this.setConfig({});
    }
    this.render();
    this._setupObserver();
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
    // Лог "Received data" выводится только если debug включен
    if (this.config.debug) {
      console.log("wled-ws-card: Received data:", data);
    }
    const cardEl = this.shadowRoot.getElementById('card');
    if (cardEl) {
      cardEl.style.background = data;
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
      brightness: 100
    };
  }
}

customElements.define('wled-ws-card', WledWsCard);

window.customCards = window.customCards || [];
window.customCards.push({
  type: "wled-ws-card",
  name: "WLED Live View Card",
  preview: false,
  description: "Card for displaying live view from WLED via WebSocket.",
  documentationURL: "https://github.com/danishru/wled_liveviewproxy/?tab=readme-ov-file"
});

// ======================================================================
// Редактор конфигурации (LitElement вариант)
// ======================================================================

class WledWsCardEditor extends LitElement {
  static get properties() {
    return {
      _config: { type: Object },
      hass: { type: Object }
    };
  }
  
  constructor() {
    super();
    this._config = {};
  }
  
  setConfig(config) {
    this._config = config;
  }
  
  configChanged(newConfig) {
    const event = new Event("config-changed", { bubbles: true, composed: true });
    event.detail = { config: newConfig };
    this.dispatchEvent(event);
  }
  
  static get styles() {
    return css`
      .editor {
        padding: 16px;
        font-family: var(--ha-font-family, sans-serif);
        background: var(--card-background-color, #fff);
        color: var(--primary-text-color, #333);
      }
      .selector-wrapper,
      .brightness-wrapper {
        margin-bottom: 16px;
      }
      ha-formfield {
        display: block;
        width: 100%;
      }
      ha-selector {
        width: 100%;
      }
      .brightness-wrapper ha-textfield {
        width: 100%;
      }
      .brightness-wrapper label {
        display: block;
        margin-bottom: 4px;
        font-weight: bold;
      }
      .switches-row {
        display: flex;
        gap: 16px;
      }
      .switches-row ha-formfield {
        flex: 1;
        display: flex;
        align-items: center;
        justify-content: center;
      }
      .switches-row ha-formfield > span[slot="label"] {
        order: 1;
        margin-right: 8px;
        font-size: 14px;
      }
      .switches-row ha-formfield > ha-switch {
        order: 2;
      }
    `;
  }
  
  render() {
    if (!this.hass) {
      return html`<div>Waiting for Home Assistant state...</div>`;
    }
    const sensors = Object.keys(this.hass.states).filter(
      entityId =>
        entityId.startsWith("sensor.wlvp_") &&
        this.hass.states[entityId].attributes &&
        this.hass.states[entityId].attributes.entry_id !== undefined
    );
    const selectorObj = {
      entity: {
        domain: "sensor",
        include_entities: sensors
      }
    };
    
    return html`
      <div class="editor">
        <!-- Селектор сущности без label -->
        <div class="selector-wrapper">
          <ha-formfield>
            <ha-selector
              .selector="${selectorObj}"
              .hass="${this.hass}"
              .value="${this._config.sensor || ''}"
              @value-changed="${this._sensorChanged}">
            </ha-selector>
            <span slot="label"></span>
          </ha-formfield>
        </div>
        <!-- Поле яркости карточки -->
        <div class="brightness-wrapper">
          <label>Card Brightness (%)</label>
          <ha-textfield
            .value="${this._config.brightness ? String(this._config.brightness) : '100'}"
            type="number"
            min="0"
            max="1000"
            step="1"
            @input="${this._brightnessChanged}">
          </ha-textfield>
        </div>
        <!-- Переключатели Info и Debug в одной строке -->
        <div class="switches-row">
          <ha-formfield>
            <span slot="label">Info Mode</span>
            <ha-switch
              ?checked="${this._config.info}"
              @change="${this._infoChanged}">
            </ha-switch>
          </ha-formfield>
          <ha-formfield>
            <span slot="label">Debug Mode</span>
            <ha-switch
              ?checked="${this._config.debug}"
              @change="${this._debugChanged}">
            </ha-switch>
          </ha-formfield>
        </div>
      </div>
    `;
  }
  
  _sensorChanged(e) {
    const sensor = e.detail.value;
    this._config = Object.assign({}, this._config, { sensor: sensor });
    this.configChanged(this._config);
  }
  
  _brightnessChanged(e) {
    const brightness = Number(e.target.value);
    this._config = Object.assign({}, this._config, { brightness: brightness });
    this.configChanged(this._config);
  }
  
  _infoChanged(e) {
    const info = e.target.checked;
    this._config = Object.assign({}, this._config, { info: info });
    this.configChanged(this._config);
  }
  
  _debugChanged(e) {
    const debug = e.target.checked;
    this._config = Object.assign({}, this._config, { debug: debug });
    this.configChanged(this._config);
  }
}

customElements.define('wled-ws-card-editor', WledWsCardEditor);