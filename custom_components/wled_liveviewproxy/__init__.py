from homeassistant.core import HomeAssistant
from homeassistant.helpers import device_registry as dr
from .const import DOMAIN
from homeassistant.components.http import StaticPathConfig

async def async_setup_entry(hass: HomeAssistant, config_entry):
    domain_data = hass.data.setdefault(DOMAIN, {})
    config_data = config_entry.data

    # Сохраняем конфигурацию, полученную через config flow
    domain_data.setdefault("configs", {})[config_entry.entry_id] = config_data

    # Регистрируем устройство в Device Registry
    device_registry = dr.async_get(hass)
    identifier = config_data.get("mac")
    device_registry.async_get_or_create(
        config_entry_id=config_entry.entry_id,
        identifiers={(DOMAIN, identifier)},
        connections={(DOMAIN, identifier)},
        manufacturer=config_data.get("brand", "WLED"),
        name=config_data.get("name", "WLED Device"),
        model=config_data.get("product"),
        sw_version=config_data.get("ver"),
    )

    # Инициализируем хранилище состояний для этой записи
    domain_data.setdefault("connections", {})[config_entry.entry_id] = {
        "wled_ws": None,
        "wled_task": None,
        "client_ws_list": [],
    }

    # Регистрируем статический путь для JS файла
    await hass.http.async_register_static_paths([
        StaticPathConfig(
            "/local/wled-ws-card.js",
            hass.config.path("custom_components", DOMAIN, "wled-ws-card.js"),
            False
        )
    ])

    from .views import WledWSView
    hass.http.register_view(WledWSView)

    # Получаем значение опции control (приоритет: config_entry.options > config_entry.data)
    control = config_entry.options.get("control", config_data.get("control", False))

    # Сохраняем список загруженных платформ для последующей выгрузки
    loaded_platforms = []
    if control:
        # Если control == true, создаем координатор с постоянным WS-соединением,
        # а также подключаем платформы light и sensor
        from .coordinator import WLEDDataCoordinator
        coordinator = WLEDDataCoordinator(hass, config_entry)
        await coordinator.async_config_entry_first_refresh()
        domain_data.setdefault("coordinator", {})[config_entry.entry_id] = coordinator
        hass.loop.create_task(coordinator.async_start_ws())
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
            if entity.config_entry_id == config_entry.entry_id and entity.domain == "light":
                registry.async_remove(entity.entity_id)

    domain_data.setdefault("platforms", {})[config_entry.entry_id] = loaded_platforms

    # Регистрируем слушатель обновлений опций, чтобы интеграция перезагружалась при изменениях
    config_entry.async_on_unload(config_entry.add_update_listener(update_listener))

    return True

async def async_unload_entry(hass: HomeAssistant, config_entry):
    unload_ok = True
    domain_data = hass.data.get(DOMAIN, {})
    # Выгружаем только те платформы, которые были загружены
    loaded_platforms = domain_data.get("platforms", {}).get(config_entry.entry_id, [])
    for platform in loaded_platforms:
        unload_ok &= await hass.config_entries.async_forward_entry_unload(config_entry, platform)
    
    if unload_ok:
        connections = domain_data.get("connections", {})
        if config_entry.entry_id in connections:
            del connections[config_entry.entry_id]
        if "configs" in domain_data and config_entry.entry_id in domain_data["configs"]:
            del domain_data["configs"][config_entry.entry_id]
        if "coordinator" in domain_data and config_entry.entry_id in domain_data["coordinator"]:
            del domain_data["coordinator"][config_entry.entry_id]
        if "platforms" in domain_data and config_entry.entry_id in domain_data["platforms"]:
            del domain_data["platforms"][config_entry.entry_id]
    return unload_ok

async def update_listener(hass, config_entry):
    """Обработчик обновления опций. При изменении опций интеграция перезагружается."""
    await hass.config_entries.async_reload(config_entry.entry_id)
    return
