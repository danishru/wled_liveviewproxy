import asyncio
import json
import logging
import time

import aiohttp
import async_timeout
from homeassistant.helpers.update_coordinator import DataUpdateCoordinator

from .const import DOMAIN

_LOGGER = logging.getLogger(__name__)

async def connect_ws_for_coordinator(wled_ip: str, coordinator: "WLEDDataCoordinator"):
    """
    Устанавливает постоянное WebSocket-соединение с WLED.
    Отправляет команду {"v": true} для запроса полного JSON-состояния,
    затем запускает механизм ping/pong на уровне приложения:
    отправляем строку "ping" и ожидаем "pong" от WLED.
    Если за 10 секунд не получен ответ "pong", логируется ошибка (но только один раз),
    устройство помечается как недоступное и соединение закрывается.
    """
    try:
        _LOGGER.debug("Coordinator: Creating ClientSession for WLED at ws://%s/ws", wled_ip)
        async with aiohttp.ClientSession() as session:
            _LOGGER.debug("Coordinator: Attempting to connect to WLED at ws://%s/ws", wled_ip)
            async with async_timeout.timeout(10):
                ws = await session.ws_connect(f"ws://{wled_ip}/ws")
            _LOGGER.debug("Coordinator: Successfully connected to WLED at ws://%s/ws", wled_ip)
            coordinator.ws = ws
            coordinator.device_available = True
            coordinator.async_set_updated_data(coordinator.data)

            _LOGGER.debug("Coordinator: Sending command {\"v\": true} to request full JSON state.")
            await ws.send_str('{"v": true}')

            # Инициализируем время последнего полученного pong
            last_pong = time.monotonic()

            async def ping_loop():
                """Отправляет ping каждые 5 секунд и проверяет получение pong."""
                nonlocal last_pong
                while True:
                    await asyncio.sleep(5)
                    try:
                        _LOGGER.debug("Coordinator: Sending ping to WLED.")
                        await ws.send_str("ping")
                    except Exception as e:
                        _LOGGER.error("Coordinator: Error sending ping: %s", e)
                        break
                    if time.monotonic() - last_pong > 15:
                        if coordinator.device_available:
                            _LOGGER.error("Coordinator: No pong received within 15 seconds, device unavailable.")
                            coordinator.device_available = False
                            coordinator.async_set_updated_data(coordinator.data)
                        else:
                            _LOGGER.debug("Coordinator: Continuing without pong, device already unavailable.")
                        await ws.close()
                        break

            ping_task = asyncio.create_task(ping_loop())

            while True:
                try:
                    _LOGGER.debug("Coordinator: Waiting for message from WLED...")
                    async with async_timeout.timeout(10):
                        msg = await ws.receive()
                    _LOGGER.debug("Coordinator: Received message: type=%s, data=%s", msg.type, msg.data)
                except asyncio.TimeoutError:
                    _LOGGER.debug("Coordinator: No message received within 10 seconds, continuing to wait.")
                    continue

                if msg.type == aiohttp.WSMsgType.TEXT:
                    if msg.data.strip().lower() == "pong":
                        _LOGGER.debug("Coordinator: Received pong from WLED.")
                        last_pong = time.monotonic()
                        if not coordinator.device_available:
                            _LOGGER.info("Coordinator: Device is available again.")
                            coordinator.device_available = True
                            coordinator.async_set_updated_data(coordinator.data)
                        continue
                    else:
                        try:
                            json_data = json.loads(msg.data)
                            _LOGGER.debug("Coordinator: Parsed JSON data: %s", json_data)
                            # Если полученные данные содержат ключ "state", обновляем состояние
                            if "state" in json_data:
                                coordinator.async_set_updated_data(json_data)
                            else:
                                # Если полезной нагрузки нет, просто обновляем доступность устройства
                                coordinator.device_available = True
                                _LOGGER.debug("Coordinator: Received response without 'state', setting device_available=True")
                        except Exception as e:
                            _LOGGER.error("Coordinator: Error parsing JSON: %s", e)
                elif msg.type in (aiohttp.WSMsgType.CLOSED, aiohttp.WSMsgType.ERROR):
                    _LOGGER.debug("Coordinator: WebSocket closed or encountered error, will reconnect.")
                    break
                else:
                    _LOGGER.debug("Coordinator: Received unrecognized message type: %s", msg.type)
            
            ping_task.cancel()
            try:
                await ping_task
            except asyncio.CancelledError:
                pass

            _LOGGER.debug("Coordinator: Exiting message loop, closing WebSocket connection.")
            await ws.close()
    except Exception as err:
        if coordinator.device_available:
            _LOGGER.error("Coordinator: Error connecting to WLED via WebSocket: %s", err)
            coordinator.device_available = False
            coordinator.async_set_updated_data(coordinator.data)
        else:
            _LOGGER.debug("Coordinator: Error connecting to WLED via WebSocket (device already unavailable): %s", err)
    finally:
        coordinator.ws = None

class WLEDDataCoordinator(DataUpdateCoordinator):
    """
    Координатор для интеграции WLED.
    Данные обновляются через push (WebSocket) с использованием механизма ping/pong.
    Поддерживает одно активное WS-соединение для получения обновлений и отправки команд.
    """
    def __init__(self, hass, config_entry):
        super().__init__(
            hass,
            _LOGGER,
            name="WLED Data",
            update_interval=None,  # опрос не используется, данные приходят через push
        )
        self.config_entry = config_entry
        self.wled_ip = self.config_entry.options.get("wled_ip", self.config_entry.data.get("wled_ip"))
        self.data = None
        self.ws = None
        self._send_lock = asyncio.Lock()
        self.device_available = True
        _LOGGER.debug("Coordinator: Initialized with WLED IP: %s", self.wled_ip)

    async def _async_update_data(self):
        _LOGGER.debug("Coordinator: _async_update_data called (dummy method).")
        return self.data

    async def async_start_ws(self):
        _LOGGER.debug("Coordinator: Starting WebSocket connection loop.")
        while True:
            _LOGGER.debug("Coordinator: Connecting to WLED at IP: %s", self.wled_ip)
            await connect_ws_for_coordinator(self.wled_ip, self)
            _LOGGER.debug("Coordinator: WS connection ended, waiting 10 seconds before reconnecting.")
            await asyncio.sleep(10)

    async def send_command(self, command: dict):
        async with self._send_lock:
            if self.ws is not None:
                try:
                    _LOGGER.debug("Coordinator: Sending command: %s", command)
                    await self.ws.send_str(json.dumps(command))
    
                    """
                    # Всегда запрашиваем полное состояние после отправки команды
                    await asyncio.sleep(0.1)  # небольшая задержка
                    await self.ws.send_str('{"v": true}')
                    _LOGGER.debug("Coordinator: Full device state requested")
                    """
    
                except Exception as e:
                    _LOGGER.error("Coordinator: Error sending command: %s", e)
            else:
                _LOGGER.error("Coordinator: No active WS connection.")

