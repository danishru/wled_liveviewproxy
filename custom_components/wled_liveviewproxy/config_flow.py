import voluptuous as vol
import homeassistant.helpers.config_validation as cv
from homeassistant import config_entries
from homeassistant.core import callback
import asyncio
import json
import aiohttp

DOMAIN = "wled_liveviewproxy"

# Начальная схема конфигурации включает IP устройства и опцию control.
DATA_SCHEMA = vol.Schema({
    vol.Required("wled_ip"): cv.string,
    vol.Optional("control", default=False): bool,
})

# Схема для Options Flow – позволяет менять значение control и wled_ip после создания записи.
OPTIONS_SCHEMA = vol.Schema({
    vol.Required("wled_ip"): cv.string,
    vol.Required("control", default=False): bool,
})

class OptionsFlowHandler(config_entries.OptionsFlow):
    """Обработчик опций для WLED Live View Proxy."""
    def __init__(self, config_entry):
        self.config_entry = config_entry

    async def async_step_init(self, user_input: dict | None = None):
        """Управление опциями."""
        if user_input is not None:
            return self.async_create_entry(data=user_input)
        
        # Если опции ещё не заданы, подставляем значения из config_entry.data
        initial_options = dict(self.config_entry.options)
        if "control" not in initial_options:
            initial_options["control"] = self.config_entry.data.get("control", False)
        if "wled_ip" not in initial_options:
            initial_options["wled_ip"] = self.config_entry.data.get("wled_ip")
        
        return self.async_show_form(
            step_id="init",
            data_schema=self.add_suggested_values_to_schema(OPTIONS_SCHEMA, initial_options),
        )

class WledLiveViewProxyConfigFlow(config_entries.ConfigFlow, domain=DOMAIN):
    """Конфигурационный поток для WLED Live View Proxy."""
    VERSION = 1

    async def async_step_user(self, user_input=None):
        """Обработка шага, инициированного пользователем."""
        errors = {}
        if user_input is not None:
            wled_ip = user_input["wled_ip"]
            device_info = {}
            try:
                async with aiohttp.ClientSession() as session:
                    ws_url = f"ws://{wled_ip}/ws"
                    ws = await session.ws_connect(ws_url, timeout=5)
                    msg = await ws.receive(timeout=5)
                    if msg.type == aiohttp.WSMsgType.TEXT:
                        try:
                            json_data = json.loads(msg.data)
                            info = json_data.get("info", {})
                            # Извлекаем необходимые поля
                            device_info["ver"] = info.get("ver")
                            device_info["mac"] = info.get("mac")
                            device_info["name"] = f"WLVP - {info.get('name')}"
                            device_info["arch"] = info.get("arch")
                            device_info["ip"] = info.get("ip")
                            device_info["brand"] = info.get("brand")
                            device_info["product"] = info.get("product")
                        except Exception as e:
                            self.hass.components.logger.warning(
                                DOMAIN, f"Ошибка парсинга JSON: {e}"
                            )
                    await ws.close()
            except Exception as e:
                errors["base"] = f"Ошибка подключения к WLED: {str(e)}"
                return self.async_show_form(
                    step_id="user",
                    data_schema=DATA_SCHEMA,
                    errors=errors,
                )
            if not device_info or not device_info.get("name"):
                errors["base"] = "Не удалось получить данные от WLED. Проверьте корректность IP и доступность устройства."
                return self.async_show_form(
                    step_id="user",
                    data_schema=DATA_SCHEMA,
                    errors=errors,
                )
            title = device_info["name"]
            # Объединяем данные, введённые пользователем, с данными от WLED.
            config_data = {**user_input, **device_info}
            return self.async_create_entry(title=title, data=config_data)
        return self.async_show_form(
            step_id="user",
            data_schema=DATA_SCHEMA,
            errors=errors,
        )

    @staticmethod
    @callback
    def async_get_options_flow(config_entry):
        """Создать обработчик опций."""
        return OptionsFlowHandler(config_entry)
