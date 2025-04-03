"""
light.py

Светильник для интеграции WLED Live View Proxy.
Состояние устройства (on/off, яркость, эффект) обновляется через push‑обновления,
поступающие из координатора (DataUpdateCoordinator), который получает данные через WebSocket.
Команды включения/выключения и изменения яркости отправляются на WLED через основное WS‑соединение,
управляемое координатором.
Начальные свойства сущности задаются сразу при инициализации на основе данных, полученных координатором.
"""

import json
import logging
from aiohttp import ClientSession
from homeassistant.components.light import LightEntity
from homeassistant.helpers.device_registry import format_mac
from homeassistant.helpers.update_coordinator import CoordinatorEntity
from .const import DOMAIN

_LOGGER = logging.getLogger(__name__)

async def async_setup_entry(hass, config_entry, async_add_entities):
    """Настроить платформу света для WLED с использованием координатора.
    
    Ждёт, пока координатор получит начальные данные, и только затем создаёт сущность.
    """
    coordinator = hass.data[DOMAIN]["coordinator"][config_entry.entry_id]
    _LOGGER.debug("[%s] Light: Waiting for coordinator initial refresh...", config_entry.entry_id)
    await coordinator.async_config_entry_first_refresh()
    _LOGGER.debug("[%s] Light: Coordinator data received. Adding WLEDLight entity.", config_entry.entry_id)
    async_add_entities([WLEDLight(coordinator, config_entry)], update_before_add=True)

class WLEDLight(CoordinatorEntity, LightEntity):
    """Светильник WLED, обновляемый через DataUpdateCoordinator (push‑обновления)."""
    _attr_has_entity_name = True
    _attr_name = None

    def __init__(self, coordinator, config_entry):
        """Инициализация светильника с установкой начальных свойств из координатора."""
        super().__init__(coordinator)
        self._entry_id = config_entry.entry_id
        self._config = config_entry.data
        self._device_name = self._config.get("name", "WLED Light")

        _LOGGER.debug("[%s] Light: Initializing WLEDLight entity.", self._entry_id)

        data = coordinator.data or {}
        state_data = data.get("state", {})
        info = data.get("info", {})

        self._state = state_data.get("on", False)
        self._brightness = state_data.get("bri")
        self._effect = state_data.get("fx")
        self._supported_color_modes = {"brightness"}
        self._color_mode = "brightness"
        self._mac = None
        if info and "mac" in info:
            try:
                self._mac = format_mac(info["mac"])
            except Exception:
                self._mac = info["mac"]

        _LOGGER.debug("[%s] Light: Initialized with device name: %s, state: %s, brightness: %s, mac: %s",
                      self._entry_id, self._device_name, self._state, self._brightness, self._mac)

    @property
    def unique_id(self):
        """Уникальный идентификатор: основан на MAC (если получен) или _entry_id с суффиксом '_light'."""
        base = self._config.get("mac", self._entry_id)
        return f"{base}_light"

    @property
    def device_info(self):
        """
        Связывает светильник с устройством через ключ identifiers.
        Дополнительные поля не возвращаются, поскольку обновление параметров осуществляется через координатор.
        """
        return {"identifiers": {(DOMAIN, self._config.get("mac", self._entry_id))}}

    @property
    def is_on(self):
        """Возвращает состояние светильника: включён/выключен."""
        _LOGGER.debug("[%s] Light: is_on property queried: %s", self._entry_id, self._state)
        return self._state

    @property
    def brightness(self):
        """Возвращает яркость (1-255)."""
        _LOGGER.debug("[%s] Light: brightness property queried: %s", self._entry_id, self._brightness)
        return self._brightness

    @property
    def color_mode(self):
        """Всегда возвращает 'brightness'."""
        return "brightness"

    @property
    def supported_color_modes(self):
        """Поддерживаемые режимы – только 'brightness'."""
        return self._supported_color_modes

    @property
    def effect(self):
        """Возвращает текущий эффект, если он есть."""
        _LOGGER.debug("[%s] Light: effect property queried: %s", self._entry_id, self._effect)
        return self._effect

    @property
    def available(self):
        coordinator = self.hass.data.get(DOMAIN, {}).get("coordinator", {}).get(self._entry_id)
        if coordinator is not None:
            _LOGGER.debug("[%s] Light: available property queried: %s", self._entry_id, coordinator.device_available)
            return coordinator.device_available
        return True

    def _handle_coordinator_update(self):
        """Обрабатывает обновление данных, полученных координатором."""
        data = self.coordinator.data
        _LOGGER.debug("[%s] Light: _handle_coordinator_update received data: %s", self._entry_id, data)
        if data:
            state_data = data.get("state", {})
            info = data.get("info", {})

            self._state = state_data.get("on", False)
            self._brightness = state_data.get("bri")
            self._effect = state_data.get("fx")

            if info:
                mac = info.get("mac")
                if mac:
                    try:
                        self._mac = format_mac(mac)
                    except Exception:
                        self._mac = mac
        else:
            self._state = False
            self._brightness = None
            self._effect = None

        self._attr_available = self.coordinator.device_available

        _LOGGER.debug("[%s] Light: Updated state: %s, brightness: %s, effect: %s, mac: %s, available: %s",
                      self._entry_id, self._state, self._brightness, self._effect, self._mac, self._attr_available)
        self.async_write_ha_state()

    async def async_added_to_hass(self):
        """Подписывается на обновления координатора при добавлении в HA."""
        await super().async_added_to_hass()
        _LOGGER.debug("[%s] Light: Subscribing to coordinator updates.", self._entry_id)
        self.async_on_remove(
            self.coordinator.async_add_listener(self._handle_coordinator_update)
        )

    async def async_turn_on(self, **kwargs):
        _LOGGER.debug("[%s] Light: Turning on via main WS connection.", self._entry_id)
        brightness = kwargs.get("brightness")
        command = {"on": True}
        if brightness is not None:
            command["bri"] = brightness
        if self.coordinator.ws is not None:
            await self.coordinator.send_command(command)
            _LOGGER.debug("[%s] Light: Sent turn on command via main WS: %s", self._entry_id, command)
        else:
            _LOGGER.error("[%s] Light: No active WS connection to send command. Command not sent.", self._entry_id)
        self._state = True
        if brightness is not None:
            self._brightness = brightness
        self.async_write_ha_state()

    async def async_turn_off(self, **kwargs):
        _LOGGER.debug("[%s] Light: Turning off via main WS connection.", self._entry_id)
        command = {"on": False}
        if self.coordinator.ws is not None:
            await self.coordinator.send_command(command)
            _LOGGER.debug("[%s] Light: Sent turn off command via main WS: %s", self._entry_id, command)
        else:
            _LOGGER.error("[%s] Light: No active WS connection to send command. Command not sent.", self._entry_id)
        self._state = False
        self.async_write_ha_state()
