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
    затем запускает механизм ping/pong: отправляем "ping" и ожидаем "pong".
    Если за 15 секунд не получен pong, устройство помечается как недоступное и соединение закрывается.
    """
    entry_id = coordinator.entry_id
    try:
        _LOGGER.debug("[%s] Creating ClientSession for WLED at ws://%s/ws", entry_id, wled_ip)
        async with aiohttp.ClientSession() as session:
            _LOGGER.debug("[%s] Attempting to connect to WLED at ws://%s/ws", entry_id, wled_ip)
            async with async_timeout.timeout(10):
                ws = await session.ws_connect(f"ws://{wled_ip}/ws")
            _LOGGER.debug("[%s] Successfully connected to WLED at ws://%s/ws", entry_id, wled_ip)
            coordinator.ws = ws
            coordinator.device_available = True
            coordinator.async_set_updated_data(coordinator.data)
            
            # Если fxdata отсутствует в данных, запрашиваем его сразу после установления соединения.
            if not coordinator.data or "fxdata" not in coordinator.data:
                _LOGGER.debug("[%s] fxdata not found in data, fetching effects.", entry_id)
                await coordinator.async_fetch_effects()
            
            _LOGGER.debug("[%s] Sending command {\"v\": true} to request full JSON state.", entry_id)
            await ws.send_str('{"v": true}')
            
            last_pong = time.monotonic()
            
            async def ping_loop():
                nonlocal last_pong
                while True:
                    await asyncio.sleep(5)
                    try:
                        _LOGGER.debug("[%s] Sending ping to WLED.", entry_id)
                        await ws.send_str("ping")
                    except Exception as e:
                        _LOGGER.error("[%s] Error sending ping: %s", entry_id, e)
                        break
                    if time.monotonic() - last_pong > 15:
                        if coordinator.device_available:
                            _LOGGER.error("[%s] No pong received within 15 seconds, device unavailable.", entry_id)
                            coordinator.device_available = False
                            coordinator.async_set_updated_data(coordinator.data)
                        else:
                            _LOGGER.debug("[%s] Continuing without pong, device already unavailable.", entry_id)
                        await ws.close()
                        break
            
            ping_task = asyncio.create_task(ping_loop())
            
            while True:
                try:
                    _LOGGER.debug("[%s] Waiting for message from WLED...", entry_id)
                    async with async_timeout.timeout(10):
                        msg = await ws.receive()
                    _LOGGER.debug("[%s] Received message: type=%s, data=%s", entry_id, msg.type, msg.data)
                except asyncio.TimeoutError:
                    _LOGGER.debug("[%s] No message received within 10 seconds, continuing to wait.", entry_id)
                    continue
                
                if msg.type == aiohttp.WSMsgType.TEXT:
                    if msg.data.strip().lower() == "pong":
                        _LOGGER.debug("[%s] Received pong from WLED.", entry_id)
                        last_pong = time.monotonic()
                        if not coordinator.device_available:
                            _LOGGER.info("[%s] Device is available again.", entry_id)
                            coordinator.device_available = True
                            coordinator.async_set_updated_data(coordinator.data)
                        continue
                    else:
                        try:
                            json_data = json.loads(msg.data)
                            _LOGGER.debug("[%s] Parsed JSON data: %s", entry_id, json_data)
                            if "state" in json_data:
                                coordinator.process_new_data(json_data)
                            else:
                                coordinator.device_available = True
                                _LOGGER.debug("[%s] Received response without 'state', setting device_available=True", entry_id)
                        except Exception as e:
                            _LOGGER.error("[%s] Error parsing JSON: %s", entry_id, e)
                elif msg.type in (aiohttp.WSMsgType.CLOSED, aiohttp.WSMsgType.ERROR):
                    _LOGGER.debug("[%s] WebSocket closed or encountered error, will reconnect.", entry_id)
                    break
                else:
                    _LOGGER.debug("[%s] Received unrecognized message type: %s", entry_id, msg.type)
            
            ping_task.cancel()
            try:
                await ping_task
            except asyncio.CancelledError:
                pass
            
            _LOGGER.debug("[%s] Exiting message loop, closing WebSocket connection.", entry_id)
            await ws.close()
    except Exception as err:
        if coordinator.device_available:
            _LOGGER.error("[%s] Error connecting to WLED via WebSocket: %s", entry_id, err)
            coordinator.device_available = False
            coordinator.async_set_updated_data(coordinator.data)
        else:
            _LOGGER.debug("[%s] Error connecting to WLED via WebSocket (device already unavailable): %s", entry_id, err)
    finally:
        coordinator.ws = None

class WLEDDataCoordinator(DataUpdateCoordinator):
    """
    Координатор для интеграции WLED.
    Данные обновляются через push (WebSocket) с использованием механизма ping/pong.
    """
    def __init__(self, hass, config_entry):
        super().__init__(hass, _LOGGER, name="WLED Data", update_interval=None)
        self.config_entry = config_entry
        self.wled_ip = self.config_entry.options.get("wled_ip", self.config_entry.data.get("wled_ip"))
        self.data = None
        self.ws = None
        self._send_lock = asyncio.Lock()
        self.device_available = True
        self._last_ver = None
        self._last_has_startY = None
        self._last_device_available = False
        self._fxdata_lock = asyncio.Lock()
        self._pending_response_future = None
        self.entry_id = config_entry.entry_id
        self._ws_task = None  # Сохраняем задачу цикла WS-соединения
        _LOGGER.debug("[%s] Initialized with WLED IP: %s", self.entry_id, self.wled_ip)

    async def _async_update_data(self):
        """
        Первичное обновление данных интеграции.
        Если fxdata отсутствует, выполняется запрос списка эффектов.
        """
        if not self.data or "fxdata" not in self.data:
            _LOGGER.debug("[%s] Initial update: fxdata not found, fetching effects.", self.entry_id)
            new_data = {} if self.data is None else self.data
            effects_data = await self.async_fetch_effects()
            new_data["fxdata"] = effects_data.get("fxdata", [])
            return new_data
        return self.data

    async def async_start_ws(self):
        _LOGGER.debug("[%s] Starting WebSocket connection loop.", self.entry_id)
        # Сохраняем задачу цикла в атрибуте
        self._ws_task = asyncio.create_task(self._ws_loop())
        try:
            await self._ws_task
        except asyncio.CancelledError:
            _LOGGER.debug("[%s] WS loop task cancelled.", self.entry_id)

    async def _ws_loop(self):
        # Этот метод содержит тот же цикл, что был ранее в async_start_ws()
        while True:
            _LOGGER.debug("[%s] Connecting to WLED at IP: %s", self.entry_id, self.wled_ip)
            await connect_ws_for_coordinator(self.wled_ip, self)
            _LOGGER.debug("[%s] WS connection ended, waiting 10 seconds before reconnecting.", self.entry_id)
            await asyncio.sleep(10)

    async def send_command(self, command: dict, await_response: bool = True, timeout: float = 5.0) -> dict:
        response_future = None
        if await_response:
            response_future = asyncio.get_event_loop().create_future()
            self._pending_response_future = response_future
        async with self._send_lock:
            if self.ws is not None:
                try:
                    _LOGGER.debug("[%s] Sending command: %s", self.entry_id, command)
                    await self.ws.send_str(json.dumps(command))
                except Exception as e:
                    _LOGGER.error("[%s] Error sending command: %s", self.entry_id, e)
                    if response_future:
                        response_future.set_exception(e)
                    return None
            else:
                error_msg = "No active WS connection."
                _LOGGER.error("[%s] %s", self.entry_id, error_msg)
                if response_future:
                    response_future.set_exception(Exception(error_msg))
                return None
        if response_future:
            try:
                response = await asyncio.wait_for(response_future, timeout=timeout)
                return response
            except asyncio.TimeoutError:
                _LOGGER.error("[%s] Timeout waiting for response", self.entry_id)
                return None
            finally:
                self._pending_response_future = None
        return None

    async def async_fetch_effects(self):
        """
        Получает список эффектов и метаданных эффектов с WLED.
        Выполняет HTTP GET запросы к эндпоинтам /json/eff и /json/fxdata.
        Если устройство возвращает "0", генерируется исключение.
        Возвращает словарь с ключом:
          - 'fxdata': список, где каждый элемент — словарь с ключами "name", "metadata" и "flags".
        """
        async with self._fxdata_lock:
            try:
                async with aiohttp.ClientSession() as session:
                    eff_url = f"http://{self.wled_ip}/json/eff"
                    fxdata_url = f"http://{self.wled_ip}/json/fxdata"
                    
                    async with session.get(eff_url) as response_eff:
                        text_eff = await response_eff.text()
                    if text_eff.strip() == "0":
                        raise Exception("Endpoint /json/eff returned 0")
                    effects = json.loads(text_eff)
                    
                    async with session.get(fxdata_url) as response_fx:
                        text_fx = await response_fx.text()
                    if text_fx.strip() == "0":
                        raise Exception("Endpoint /json/fxdata returned 0")
                    fxdata = json.loads(text_fx)
                
                combined = []
                for i, effect in enumerate(effects):
                    meta = fxdata[i] if i < len(fxdata) else ""
                    sections = meta.split(";")
                    if len(sections) >= 4 and sections[3].strip():
                        flags = sections[3].strip()
                    else:
                        flags = "1"
                    combined.append({
                        "name": effect,
                        "metadata": meta,
                        "flags": flags,
                    })
                
                _LOGGER.debug("[%s] Combined fxdata: %s", self.entry_id, combined)
                return {"fxdata": combined}
            except Exception as err:
                _LOGGER.error("[%s] Error fetching effects and fxdata: %s", self.entry_id, err)
                return {"fxdata": self.data.get("fxdata", []) if self.data else []}

    def _has_startY(self, data):
        segs = data.get("state", {}).get("seg", [])
        _LOGGER.debug("[%s] Checking segments for startY: %s", self.entry_id, segs)
        for seg in segs:
            if "startY" in seg:
                _LOGGER.debug("[%s] Found startY in segment: %s", self.entry_id, seg)
                return True
        _LOGGER.debug("[%s] No segment contains startY.", self.entry_id)
        return False

    def _should_update_effects(self, new_data):
        new_ver = new_data.get("info", {}).get("ver")
        new_has_startY = self._has_startY(new_data)
        _LOGGER.debug("[%s] Comparing versions: old %s, new %s", self.entry_id, self._last_ver, new_ver)
        _LOGGER.debug("[%s] Comparing startY presence: old %s, new %s", self.entry_id, self._last_has_startY, new_has_startY)
        if new_ver != self._last_ver or new_has_startY != self._last_has_startY:
            self._last_ver = new_ver
            self._last_has_startY = new_hasStartY = new_has_startY
            return True
        return False

    def process_new_data(self, new_data):
        if not self._last_device_available and self.device_available:
            _LOGGER.debug("[%s] Device transitioned from unavailable to available; fetching new effects.", self.entry_id)
            asyncio.create_task(self.async_update_effects(new_data))
        if self._should_update_effects(new_data):
            _LOGGER.debug("[%s] Version or segment structure changed; fetching new effects.", self.entry_id)
            asyncio.create_task(self.async_update_effects(new_data))
        self._last_device_available = self.device_available
        if self._pending_response_future is not None and not self._pending_response_future.done():
            self._pending_response_future.set_result(new_data)
        self.async_set_updated_data(new_data)

    async def async_update_effects(self, data):
        effects_data = await self.async_fetch_effects()
        data["fxdata"] = effects_data.get("fxdata", [])
        self.async_set_updated_data(data)

    async def async_shutdown(self):
        _LOGGER.debug("[%s] Shutting down coordinator.", self.entry_id)
        # Отменяем задачу цикла WS-соединения, если она запущена
        if self._ws_task is not None:
            self._ws_task.cancel()
            try:
                await self._ws_task
            except asyncio.CancelledError:
                _LOGGER.debug("[%s] WS task cancelled successfully.", self.entry_id)
            self._ws_task = None
        # Отменяем ожидающий future, если есть
        if self._pending_response_future is not None and not self._pending_response_future.done():
            self._pending_response_future.cancel()
        # Закрываем WS-соединение, если оно открыто
        if self.ws is not None:
            try:
                await self.ws.close()
            except Exception as e:
                _LOGGER.error("[%s] Error closing WS during shutdown: %s", self.entry_id, e)
            self.ws = None
