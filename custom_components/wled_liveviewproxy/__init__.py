from homeassistant.core import HomeAssistant
from homeassistant.helpers import device_registry as dr
from .const import DOMAIN
from homeassistant.components.http import StaticPathConfig
import logging

_LOGGER = logging.getLogger(__name__)

async def async_setup_entry(hass: HomeAssistant, config_entry):
    entry_id = config_entry.entry_id
    _LOGGER.debug(f"[{entry_id}] async_setup_entry: Starting setup.")
    domain_data = hass.data.setdefault(DOMAIN, {})
    config_data = config_entry.data

    # Сохраняем конфигурацию, полученную через config flow
    domain_data.setdefault("configs", {})[entry_id] = config_data
    _LOGGER.debug(f"[{entry_id}] async_setup_entry: Saved configuration.")

    # Регистрируем устройство в Device Registry
    device_registry = dr.async_get(hass)
    identifier = config_data.get("mac")
    device_registry.async_get_or_create(
        config_entry_id=entry_id,
        identifiers={(DOMAIN, identifier)},
        connections={(DOMAIN, identifier)},
        manufacturer=config_data.get("brand", "WLED"),
        name=config_data.get("name", "WLED Device"),
        model=config_data.get("product"),
        sw_version=config_data.get("ver"),
    )
    _LOGGER.debug(f"[{entry_id}] async_setup_entry: Device registered in Device Registry.")

    # Инициализируем хранилище состояний для этой записи
    domain_data.setdefault("connections", {})[entry_id] = {
        "wled_ws": None,
        "wled_task": None,
        "client_ws_list": [],
    }
    _LOGGER.debug(f"[{entry_id}] async_setup_entry: Initialized connections storage.")

    # Регистрируем статический путь для JS файла
    await hass.http.async_register_static_paths([
        StaticPathConfig(
            "/local/wled-ws-card.js",
            hass.config.path("custom_components", DOMAIN, "wled-ws-card.js"),
            False
        )
    ])
    _LOGGER.debug(f"[{entry_id}] async_setup_entry: Registered static path for JS file.")

    from .views import WledWSView
    hass.http.register_view(WledWSView)
    _LOGGER.debug(f"[{entry_id}] async_setup_entry: Registered WledWSView.")

    # Получаем значение опции control (приоритет: config_entry.options > config_entry.data)
    control = (config_entry.options or {}).get("control", config_data.get("control", False))
    _LOGGER.debug(f"[{entry_id}] async_setup_entry: Control option: {control}")

    # Сохраняем список загруженных платформ для последующей выгрузки
    loaded_platforms = []
    if control:
        # Если control == true, создаем координатор с постоянным WS-соединением,
        # а также подключаем платформы light и sensor
        from .coordinator import WLEDDataCoordinator
        coordinator = WLEDDataCoordinator(hass, config_entry)
        await coordinator.async_config_entry_first_refresh()
        domain_data.setdefault("coordinator", {})[entry_id] = coordinator
        _LOGGER.debug(f"[{entry_id}] async_setup_entry: Coordinator created and refreshed.")
        # Запускаем WS-соединение в фоне
        hass.loop.create_task(coordinator.async_start_ws())
        _LOGGER.debug(f"[{entry_id}] async_setup_entry: Started WS connection task.")
        await hass.config_entries.async_forward_entry_setups(config_entry, ["sensor", "light"])
        loaded_platforms = ["sensor", "light"]
    else:
        # Если control == false, создаем только платформу sensor
        await hass.config_entries.async_forward_entry_setups(config_entry, ["sensor"])
        loaded_platforms = ["sensor"]

        # Если ранее были созданы light-сущности, удаляем их из реестра сущностей.
        from homeassistant.helpers.entity_registry import async_get as async_get_registry
        registry = async_get_registry(hass)
        for entity in list(registry.entities.values()):
            if entity.config_entry_id == entry_id and entity.domain == "light":
                registry.async_remove(entity.entity_id)
        _LOGGER.debug(f"[{entry_id}] async_setup_entry: Removed legacy light entities.")

    domain_data.setdefault("platforms", {})[entry_id] = loaded_platforms
    _LOGGER.debug(f"[{entry_id}] async_setup_entry: Loaded platforms: {loaded_platforms}")

    # Регистрируем службу для отправки команд (общая для всех записей)
    from .services import async_register_send_command_service
    async_register_send_command_service(hass)
    _LOGGER.debug(f"[{entry_id}] async_setup_entry: Registered send command service.")

    # Регистрируем слушатель обновлений опций, чтобы интеграция перезагружалась при изменениях
    config_entry.async_on_unload(config_entry.add_update_listener(update_listener))
    _LOGGER.debug(f"[{entry_id}] async_setup_entry: Registered update listener.")

    _LOGGER.debug(f"[{entry_id}] async_setup_entry: Setup completed.")
    return True

async def async_unload_entry(hass: HomeAssistant, config_entry):
    entry_id = config_entry.entry_id
    _LOGGER.debug(f"[{entry_id}] async_unload_entry: Starting unload process.")
    unload_ok = True
    domain_data = hass.data.get(DOMAIN, {})
    loaded_platforms = domain_data.get("platforms", {}).get(entry_id, [])
    for platform in loaded_platforms:
        unload_ok &= await hass.config_entries.async_forward_entry_unload(config_entry, platform)
        _LOGGER.debug(f"[{entry_id}] async_unload_entry: Unloaded platform: {platform}")
    
    if unload_ok:
        if "coordinator" in domain_data and entry_id in domain_data["coordinator"]:
            coordinator = domain_data["coordinator"][entry_id]
            _LOGGER.debug(f"[{entry_id}] async_unload_entry: Shutting down coordinator.")
            await coordinator.async_shutdown()  # Ждем завершения shutdown
            del domain_data["coordinator"][entry_id]
            _LOGGER.debug(f"[{entry_id}] async_unload_entry: Coordinator removed.")
        if "connections" in domain_data and entry_id in domain_data["connections"]:
            del domain_data["connections"][entry_id]
            _LOGGER.debug(f"[{entry_id}] async_unload_entry: Connections removed.")
        if "configs" in domain_data and entry_id in domain_data["configs"]:
            del domain_data["configs"][entry_id]
            _LOGGER.debug(f"[{entry_id}] async_unload_entry: Configurations removed.")
        if "platforms" in domain_data and entry_id in domain_data["platforms"]:
            del domain_data["platforms"][entry_id]
            _LOGGER.debug(f"[{entry_id}] async_unload_entry: Platforms removed.")
    _LOGGER.debug(f"[{entry_id}] async_unload_entry: Unload process completed with status: {unload_ok}")
    return unload_ok

async def update_listener(hass, config_entry):
    """Обработчик обновления опций. При изменении опций интеграция перезагружается."""
    entry_id = config_entry.entry_id
    _LOGGER.debug(f"[{entry_id}] update_listener: Options updated, reloading entry.")
    await hass.config_entries.async_reload(entry_id)
    return
