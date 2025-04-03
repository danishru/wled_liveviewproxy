import asyncio
import json
import time
import logging
from aiohttp import ClientSession, WSMsgType, web
from homeassistant.components.http import HomeAssistantView
from .const import DOMAIN

_LOGGER = logging.getLogger(__name__)

def process_binary(data: bytes) -> str:
    """
    Преобразует бинарные данные от WLED в строку, содержащую только цвета для CSS‑градиента.
    Если первый байт не равен 76 (ASCII 'L'), возвращает пустую строку.
    """
    if data[0] != 76:
        return ""
    offset = 4 if data[1] == 2 else 2
    colors = []
    for i in range(offset, len(data), 3):
        if i + 2 < len(data):
            colors.append("rgb({},{},{})".format(data[i], data[i+1], data[i+2]))
    # Возвращаем только список цветов через запятую (без указания угла)
    gradient_colors = ",".join(colors)
    return gradient_colors

async def delayed_update(wled_ip: str, entry_data: dict, delay: int = 10):
    await asyncio.sleep(delay)
    await update_device_state(wled_ip, entry_data)

def schedule_update_state(wled_ip: str, entry_data: dict, delay: int = 10):
    """
    Планирует обновление состояния устройства через заданную задержку.
    Если уже запланирована задача – отменяет её и создаёт новую.
    """
    existing_task = entry_data.get("update_timer")
    if existing_task is not None and not existing_task.done():
        existing_task.cancel()
        _LOGGER.debug("[%s] Existing update_timer cancelled.", entry_data.get("entry_id", "unknown"))
    entry_data["update_timer"] = asyncio.create_task(delayed_update(wled_ip, entry_data, delay))
    _LOGGER.debug("[%s] Scheduled update_state with delay %s seconds.", entry_data.get("entry_id", "unknown"), delay)

async def connect_wled_for_entry(wled_ip: str, entry_data: dict):
    """
    Устанавливает соединение с WLED по заданному IP и ретранслирует данные всем активным клиентам для данной записи.
    
    Если приходит текстовое сообщение, оно парсится как JSON. При наличии ключей "state" и "info"
    обновляет entry_data["device_state"]. Такие сообщения не отправляются клиентам.
    
    Если приходит бинарное сообщение, оно преобразуется функцией process_binary в строку с цветами и отправляется всем клиентам.
    """
    connections = entry_data.setdefault("connections", {"client_ws_list": [], "wled_ws": None, "wled_task": None})
    entry_id = entry_data.get("entry_id", "unknown")
    # Если клиентов нет – выходим
    if not connections["client_ws_list"]:
        _LOGGER.debug("[%s] No active clients. Exiting connect_wled_for_entry.", entry_id)
        return
    try:
        async with ClientSession() as session:
            _LOGGER.debug("[%s] Attempting to connect to WLED at ws://%s/ws for this entry...", entry_id, wled_ip)
            connections["wled_ws"] = await asyncio.wait_for(
                session.ws_connect(f"ws://{wled_ip}/ws"), timeout=5
            )
            _LOGGER.debug("[%s] Connected to WLED.", entry_id)
            _LOGGER.debug("[%s] Sending live preview command.", entry_id)
            await connections["wled_ws"].send_str("{'lv':true}")
            while True:
                try:
                    # Ожидаем сообщение от WLED с таймаутом 5 секунд
                    msg = await asyncio.wait_for(connections["wled_ws"].receive(), timeout=5)
                except asyncio.TimeoutError:
                    _LOGGER.debug("[%s] No message received in 5 seconds. Exiting connection.", entry_id)
                    break

                if msg.type == WSMsgType.TEXT:
                    data = msg.data
                    # Пытаемся разобрать текстовое сообщение как JSON
                    try:
                        json_data = json.loads(data)
                        if "state" in json_data and "info" in json_data:
                            entry_data["device_state"] = json_data
                            _LOGGER.debug("[%s] Updated device state via live preview.", entry_id)
                    except Exception as e:
                        _LOGGER.error("[%s] Error parsing JSON in TEXT message: %s", entry_id, e)
                    # Не ретранслируем текстовое сообщение клиентам
                    continue
                elif msg.type == WSMsgType.BINARY:
                    data = process_binary(msg.data)
                elif msg.type in (WSMsgType.CLOSED, WSMsgType.ERROR):
                    _LOGGER.debug("[%s] WLED reported CLOSED/ERROR message. Exiting connection.", entry_id)
                    break
                else:
                    data = ""

                if data:
                    # Рассылаем данные всем активным клиентам для данной записи
                    for client in list(connections["client_ws_list"]):
                        try:
                            await client.send_str(data)
                        except Exception:
                            if client in connections["client_ws_list"]:
                                connections["client_ws_list"].remove(client)
                                _LOGGER.debug("[%s] Removed client due to send error.", entry_id)
    except Exception as e:
        _LOGGER.error("[%s] Error connecting to WLED: %s", entry_id, str(e))
    finally:
        connections["wled_ws"] = None
        _LOGGER.debug("[%s] WLED connection lost or not established for this entry. Not auto-reconnecting.", entry_id)

class WledWSView(HomeAssistantView):
    """
    WebSocket-эндпоинт для HA, позволяющий клиентам получать данные от WLED.
    При подключении клиента обновляется его heartbeat.
    Если соединение с WLED отсутствует, оно запускается, когда появляется новый клиент.
    
    Данные для каждой записи хранятся в hass.data[DOMAIN][entry_id] как единая структура с ключами:
      - "connections": для WS-соединения и списка клиентов.
      - "device_state": для хранения последнего полного JSON‑состояния.
    """
    url = "/api/wled_ws/{entry_id}"
    name = "api:wled_ws"
    requires_auth = False

    async def get(self, request: web.Request, entry_id) -> web.WebSocketResponse:
        hass = request.app["hass"]
        domain_data = hass.data.setdefault(DOMAIN, {})
        # Получаем конфигурацию интеграции для данного entry_id
        config_data = domain_data.setdefault("configs", {}).get(entry_id, {})
        # Получаем или создаём хранилище для данной записи
        entry_data = domain_data.setdefault(entry_id, {})
        entry_data.setdefault("connections", {"client_ws_list": [], "wled_ws": None, "wled_task": None})
        entry_data.setdefault("device_state", {})
        # Сохраняем ссылки на hass и entry_id в entry_data
        entry_data["hass"] = hass
        entry_data["entry_id"] = entry_id

        connections = entry_data["connections"]

        ws = web.WebSocketResponse()
        await ws.prepare(request)
        ws.last_heartbeat = time.time()
        connections["client_ws_list"].append(ws)
        _LOGGER.debug("[%s] New WS client connected. Total clients: %s", entry_id, len(connections["client_ws_list"]))

        wled_ip = config_data.get("wled_ip")
        if wled_ip:
            # При подключении нового клиента обновляем состояние устройства:
            # Если это первый клиент – обновляем сразу, иначе планируем обновление через 10 секунд.
            if len(connections["client_ws_list"]) == 1:
                asyncio.create_task(update_device_state(wled_ip, entry_data))
            else:
                schedule_update_state(wled_ip, entry_data)

        # Если соединение с WLED отсутствует, запускаем его.
        if wled_ip and connections["wled_ws"] is None and (connections.get("wled_task") is None or connections["wled_task"].done()):
            connections["wled_task"] = asyncio.create_task(connect_wled_for_entry(wled_ip, entry_data))
            _LOGGER.debug("[%s] Started WLED connection task.", entry_id)
        try:
            async for msg in ws:
                if msg.type == WSMsgType.TEXT:
                    # Обновляем heartbeat при получении сообщения "heartbeat"
                    if msg.data.strip().lower() == "heartbeat":
                        ws.last_heartbeat = time.time()
                        _LOGGER.debug("[%s] Heartbeat received from client.", entry_id)
        except Exception as e:
            _LOGGER.error("[%s] Client connection error: %s", entry_id, e)
        finally:
            if ws in connections["client_ws_list"]:
                connections["client_ws_list"].remove(ws)
            _LOGGER.debug("[%s] Client disconnected. Total clients: %s", entry_id, len(connections["client_ws_list"]))
            # При отключении клиента также обновляем состояние устройства через планирование обновления
            if wled_ip:
                schedule_update_state(wled_ip, entry_data)
        return ws

async def update_device_state(wled_ip: str, entry_data: dict):
    try:
        async with ClientSession() as session:
            _LOGGER.debug("[%s] Updating device state from WLED at ws://%s/ws...", entry_data.get("entry_id", "unknown"), wled_ip)
            ws = await asyncio.wait_for(session.ws_connect(f"ws://{wled_ip}/ws"), timeout=5)
            await ws.send_str('{"v": true}')
            msg = await asyncio.wait_for(ws.receive(), timeout=10)
            if msg.type == WSMsgType.TEXT:
                try:
                    json_data = json.loads(msg.data)
                    if "state" in json_data and "info" in json_data:
                        entry_data["device_state"] = json_data
                        _LOGGER.debug("[%s] Device state updated via {'v': true} command.", entry_data.get("entry_id", "unknown"))
                except Exception as e:
                    _LOGGER.error("[%s] Error parsing JSON in update_device_state: %s", entry_data.get("entry_id", "unknown"), e)
            await ws.close()
    except Exception as e:
        _LOGGER.error("[%s] Error updating device state: %s", entry_data.get("entry_id", "unknown"), e)