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
    Преобразует бинарные данные от WLED в строку CSS‑градиента.
    Если первый байт не равен 76 (ASCII 'L'), возвращает пустую строку.
    """
    if data[0] != 76:
        return ""
    offset = 4 if data[1] == 2 else 2
    gradient = "linear-gradient(90deg,"
    colors = []
    for i in range(offset, len(data), 3):
        if i + 2 < len(data):
            colors.append("rgb({},{},{})".format(data[i], data[i+1], data[i+2]))
    gradient += ",".join(colors) + ")"
    return gradient

async def connect_wled_for_entry(wled_ip: str, entry_data: dict):
    """
    Устанавливает соединение с WLED по заданному IP и ретранслирует данные всем активным клиентам для данной записи.
    
    Если приходит текстовое сообщение, оно парсится как JSON. При наличии ключей "state" и "info"
    обновляет entry_data["device_state"]. Такие сообщения не отправляются клиентам.
    
    Если приходит бинарное сообщение, оно преобразуется в строку CSS‑градиента и отправляется всем клиентам.
    """
    connections = entry_data.setdefault("connections", {"client_ws_list": [], "wled_ws": None, "wled_task": None})
    # Если клиентов нет – выходим
    if not connections["client_ws_list"]:
        _LOGGER.debug("No active clients for this entry. Exiting connect_wled_for_entry.")
        return
    try:
        async with ClientSession() as session:
            _LOGGER.debug(f"Attempting to connect to WLED at ws://{wled_ip}/ws for this entry...")
            connections["wled_ws"] = await asyncio.wait_for(
                session.ws_connect(f"ws://{wled_ip}/ws"), timeout=5
            )
            _LOGGER.debug("Connected to WLED. Sending live preview command.")
            await connections["wled_ws"].send_str("{'lv':true}")
            while True:
                try:
                    # Ожидаем сообщение от WLED с таймаутом 5 секунд
                    msg = await asyncio.wait_for(connections["wled_ws"].receive(), timeout=5)
                except asyncio.TimeoutError:
                    _LOGGER.debug("No message received in 5 seconds. Exiting connection.")
                    break

                if msg.type == WSMsgType.TEXT:
                    data = msg.data
                    # Пытаемся разобрать текстовое сообщение как JSON
                    try:
                        json_data = json.loads(data)
                        if "state" in json_data and "info" in json_data:
                            entry_data["device_state"] = json_data
                    except Exception as e:
                        _LOGGER.error("Error parsing JSON in TEXT message: %s", e)
                    # Не ретранслируем текстовое сообщение клиентам
                    continue
                elif msg.type == WSMsgType.BINARY:
                    data = process_binary(msg.data)
                elif msg.type in (WSMsgType.CLOSED, WSMsgType.ERROR):
                    _LOGGER.debug("WLED reported CLOSED/ERROR message. Exiting connection.")
                    break
                else:
                    data = ""

                if data:
                    _LOGGER.debug("Received from WLED (CSS gradient): %s", data)
                    # Рассылаем данные всем активным клиентам для данной записи
                    for client in list(connections["client_ws_list"]):
                        try:
                            await client.send_str(data)
                        except Exception:
                            if client in connections["client_ws_list"]:
                                connections["client_ws_list"].remove(client)
    except Exception as e:
        _LOGGER.error("Error connecting to WLED: %s", str(e))
    finally:
        connections["wled_ws"] = None
        _LOGGER.debug("WLED connection lost or not established for this entry. Not auto-reconnecting.")

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
        # Получаем конфигурацию интеграции (WLED IP) для указанного entry_id
        config_data = domain_data.setdefault("configs", {}).get(entry_id, {})
        # Получаем или создаём единое хранилище для данной записи
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
        _LOGGER.debug(f"New WS client for {entry_id} connected. Total clients: {len(connections['client_ws_list'])}")

        wled_ip = config_data.get("wled_ip")
        # При подключении нового клиента обновляем состояние устройства
        if wled_ip:
            asyncio.create_task(update_device_state(wled_ip, entry_data))

        # Если соединение с WLED отсутствует, запускаем его.
        if connections["wled_ws"] is None and (connections.get("wled_task") is None or connections["wled_task"].done()):
            connections["wled_task"] = asyncio.create_task(connect_wled_for_entry(wled_ip, entry_data))
        try:
            async for msg in ws:
                if msg.type == WSMsgType.TEXT:
                    # Обновляем heartbeat при получении сообщения "heartbeat"
                    if msg.data.strip().lower() == "heartbeat":
                        ws.last_heartbeat = time.time()
                        _LOGGER.debug("Heartbeat received from client.")
        except Exception as e:
            _LOGGER.error("Client connection error: %s", e)
        finally:
            if ws in connections["client_ws_list"]:
                connections["client_ws_list"].remove(ws)
            _LOGGER.debug(f"Client for {entry_id} disconnected. Total clients: {len(connections['client_ws_list'])}")
            # При отключении клиента тоже обновляем состояние устройства
            if wled_ip:
                asyncio.create_task(update_device_state(wled_ip, entry_data))
        return ws

async def update_device_state(wled_ip: str, entry_data: dict):
    """
    Устанавливает временное WS-соединение с WLED, отправляет команду {"v": true},
    получает полный JSON-ответ и обновляет entry_data["device_state"] для данной записи.
    """
    try:
        async with ClientSession() as session:
            _LOGGER.debug(f"Updating device state from WLED at ws://{wled_ip}/ws...")
            ws = await asyncio.wait_for(session.ws_connect(f"ws://{wled_ip}/ws"), timeout=5)
            await ws.send_str('{"v": true}')
            msg = await asyncio.wait_for(ws.receive(), timeout=10)
            if msg.type == WSMsgType.TEXT:
                try:
                    json_data = json.loads(msg.data)
                    if "state" in json_data and "info" in json_data:
                        entry_data["device_state"] = json_data
                        _LOGGER.debug("Device state updated via {'v': true} command.")
                except Exception as e:
                    _LOGGER.error("Error parsing JSON in update_device_state: %s", e)
            await ws.close()
    except Exception as e:
        _LOGGER.error("Error updating device state: %s", e)
