import json
import logging
import voluptuous as vol

from homeassistant.core import HomeAssistant, ServiceCall, HomeAssistantError, SupportsResponse
from homeassistant.helpers.device_registry import async_get as async_get_device_registry
from homeassistant.helpers.entity_registry import async_get as async_get_entity_registry
from homeassistant.helpers import config_validation as cv
from .const import DOMAIN

_LOGGER = logging.getLogger(__name__)

# Обновлённая схема сервиса
SEND_COMMAND_SCHEMA = vol.Schema({
    "targets": vol.Schema({
        "device_id": vol.Optional(vol.All(cv.ensure_list, [cv.string]), default=[]),
        "entity_id": vol.Optional(vol.All(cv.ensure_list, [cv.string]), default=[]),
    }),
    "command": dict,  # Теперь ожидается, что command уже dict, а не строка.
})

async def handle_send_command(call: ServiceCall):
    """
    Обработчик сервиса send_command.
    Извлекает выбранные устройства из call.data['targets'] (из device_id и entity_id),
    получает поле command (уже как dict), отправляет команду через координатор и возвращает ответ.
    """
    responses = {}

    # Извлекаем данные из ключа targets
    targets = call.data.get("targets", {})
    device_ids = targets.get("device_id", [])
    entity_ids = targets.get("entity_id", [])

    # Если выбраны сущности, получаем связанные device_id из реестра сущностей
    if entity_ids:
        entity_registry = async_get_entity_registry(call.hass)
        for entity_id in entity_ids:
            entity_entry = entity_registry.async_get(entity_id)
            if entity_entry and entity_entry.device_id:
                device_ids.append(entity_entry.device_id)
                _LOGGER.debug(f"[{entity_id}] Added device_id {entity_entry.device_id} from entity {entity_id}")
            else:
                _LOGGER.error(f"[{entity_id}] Entity does not have an associated device")
    
    # Если список устройств пуст, выводим предупреждение
    if not device_ids:
        _LOGGER.warning("No devices selected for sending command")
        return {"responses": responses}

    # Получаем поле command уже как dict
    command = call.data.get("command")
    if not isinstance(command, dict):
        raise HomeAssistantError("Command must be a JSON object")

    device_registry = async_get_device_registry(call.hass)

    # Для каждого уникального device_id
    for device_id in set(device_ids):
        device_entry = device_registry.async_get(device_id)
        if not device_entry:
            _LOGGER.error(f"[{device_id}] Device not found")
            continue

        # Получаем config_entry_id, взяв первый элемент из множества
        config_entry_ids = device_entry.config_entries
        if not config_entry_ids:
            _LOGGER.error(f"[{device_id}] No config entry found for device")
            continue
        config_entry_id = next(iter(config_entry_ids))

        # Логируем информацию о направлении команды
        _LOGGER.debug(f"[{config_entry_id}] Sending command: {command}")

        # Ищем координатор по config_entry_id
        coordinator = call.hass.data.get(DOMAIN, {}).get("coordinator", {}).get(config_entry_id)
        if coordinator:
            try:
                response = await coordinator.send_command(command)
                device_name = coordinator.config_entry.data.get("name", config_entry_id)
                responses[device_name] = response
                _LOGGER.debug(f"[{config_entry_id}] Command sent for device {device_name}, response: {response}")
            except Exception as e:
                _LOGGER.error(f"[{config_entry_id}] Error sending command for device: {e}")
        else:
            _LOGGER.error(f"[{config_entry_id}] Coordinator not found")
    return {"responses": responses}

def async_register_send_command_service(hass: HomeAssistant):
    """
    Регистрирует сервис send_command в Home Assistant.
    """
    hass.services.async_register(
        DOMAIN,
        "send_command",
        handle_send_command,
        schema=SEND_COMMAND_SCHEMA,
        supports_response=SupportsResponse.ONLY,
        description_placeholders={
            "docs_url": "https://kno.wled.ge/interfaces/json-api/"
        },
    )
