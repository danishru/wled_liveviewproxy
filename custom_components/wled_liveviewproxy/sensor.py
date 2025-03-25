from homeassistant.components.sensor import SensorEntity
from homeassistant.const import STATE_UNKNOWN
from .const import DOMAIN
import logging

_LOGGER = logging.getLogger(__name__)

async def async_setup_entry(hass, config_entry, async_add_entities):
    async_add_entities([WledWebSocketSensor(config_entry, hass)], update_before_add=True)

class WledWebSocketSensor(SensorEntity):
    _attr_has_entity_name = True
    _attr_name = None

    def __init__(self, config_entry, hass):
        self.hass = hass
        self._entry_id = config_entry.entry_id
        # Сохраняем конфигурацию, полученную через config_flow
        self._config = config_entry.data

    @property
    def unique_id(self):
        """Возвращает уникальный идентификатор сенсора."""
        return self._entry_id

    @property
    def state(self):
        """
        Основное состояние сенсора – количество активных клиентских WS-соединений.
        Данные берутся из hass.data[DOMAIN][entry_id]["connections"].
        """
        domain_entry = self.hass.data.get(DOMAIN, {}).get(self._entry_id, {})
        connections = domain_entry.get("connections", {})
        client_list = connections.get("client_ws_list", [])
        return len(client_list)

    @property
    def extra_state_attributes(self):
        """
        Дополнительные атрибуты сенсора:
          - entry_id для идентификации,
          - device_on – состояние устройства (ключ "state" → "on" из JSON),
          - native_ws – количество подключенных WS-клиентов (ключ "info" → "ws" из JSON).
        Данные берутся из hass.data[DOMAIN][entry_id]["device_state"].
        """
        domain_entry = self.hass.data.get(DOMAIN, {}).get(self._entry_id, {})
        full_state = domain_entry.get("device_state", {})
        device_on = full_state.get("state", {}).get("on")
        native_ws = full_state.get("info", {}).get("ws")
        return {"entry_id": self._entry_id, "device_on": device_on, "native_ws": native_ws}

    @property
    def device_info(self):
        """
        Связывает сенсор с устройством через ключ identifiers.
        Это позволяет Home Assistant объединить сущности, относящиеся к одному физическому устройству.
        """
        return {"identifiers": {(DOMAIN, self._config.get("mac", self._entry_id))}}

    @property
    def available(self):
        """
        Возвращает True, если устройство доступно.
        Если опция control включена, возвращается значение coordinator.device_available.
        """
        if self._config.get("control", False):
            coordinator = self.hass.data.get(DOMAIN, {}).get("coordinator", {}).get(self._entry_id)
            if coordinator is not None:
                return coordinator.device_available
        return True

    async def async_added_to_hass(self):
        if self._config.get("control", False):
            coordinator = self.hass.data.get(DOMAIN, {}).get("coordinator", {}).get(self._entry_id)
            if coordinator:
                _LOGGER.debug(f"WLED Sensor {self._entry_id}: coordinator update subscription established")
                self.async_on_remove(coordinator.async_add_listener(self._handle_coordinator_update))
            else:
                _LOGGER.debug(f"WLED Sensor {self._entry_id}: coordinator not found during hass startup")

    def _handle_coordinator_update(self):
        _LOGGER.debug(f"WLED Sensor {self._entry_id}: _handle_coordinator_update called")
        coordinator = self.hass.data.get(DOMAIN, {}).get("coordinator", {}).get(self._entry_id)
        if coordinator and coordinator.data:
            domain_data = self.hass.data.setdefault(DOMAIN, {})
            entry_data = domain_data.setdefault(self._entry_id, {})
            entry_data["device_state"] = coordinator.data
						  
            _LOGGER.debug(f"WLED Sensor {self._entry_id} updated device_state: {coordinator.data}")
			 
        else:
            _LOGGER.debug(f"WLED Sensor {self._entry_id}: no data received from coordinator")
        self.async_write_ha_state()

