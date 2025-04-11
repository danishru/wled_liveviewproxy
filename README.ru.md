[![GitHub Release][releases-shield]][releases]
[![GitHub Activity][commits-shield]][commits]
[![Downloads][download-shield]][Downloads]
[![License][license-shield]][license]
[![HACS Custom][hacsbadge]][hacs]

# WLED Live View Proxy for Home Assistant

## О проекте

**WLED Live View Proxy** — интеграция для Home Assistant, которая позволяет видеть живой предпросмотр устройства WLED прямо на панели управления. Интеграция проста в использовании и настраивается автоматически: достаточно просто указать IP-адрес устройства, и интеграция сама подключится и настроит всё необходимое.

https://github.com/user-attachments/assets/ae4ff0ef-f80a-408f-a198-dcd9a109cdf4

> [!IMPORTANT]\
> Эта интеграция создана при помощи ChatGPT для совместного написания кода, исправления ошибок и редактуры. Если вы придерживаетесь иной точки зрения относительно использования инструментов искусственного интеллекта, прошу принять это во внимание. Я считаю такое применение приемлемым, поскольку интеграция некоммерческая, открытая и бесплатная, и её цель — улучшить взаимодействие и удобство использования Home Assistant.

## 🆕 Что нового в v0.2.2

### 🔄 Обновления
- Карточка `wled-ws-card.js` теперь работает полностью офлайн и больше не зависит от CDN или внешних импортов.

[![Подробнее в релизе v0.2.2](https://img.shields.io/badge/Подробнее--в--релизе-v0.2.2-blue?style=for-the-badge)](https://github.com/danishru/wled_liveviewproxy/releases/tag/v0.2.2)

### 🆕 Что нового в v0.2.1

#### ✨ Новые возможности
- **🧠 [Служба JSON API команд](https://github.com/danishru/wled_liveviewproxy/blob/main/README.ru.md#служба-json-api-команд)**
  Добавлена служба `wled_liveviewproxy.send_command` для отправки JSON-команд через WebSocket с возможностью получить **полное состояние устройства**.

- **🎛️ Поддержка вращения градиента**  
  Карточка `wled-ws-card.js` теперь поддерживает настройку направления градиента прямо в конфигурации.

#### 🔄 Обновления
- Улучшен отладочный вывод, оптимизирована отправка команд по WebSocket, обновлён CDN LitElement с фиксом стилей.

[![Подробнее в релизе v0.2.1](https://img.shields.io/badge/Подробнее--в--релизе-v0.2.1-blue?style=for-the-badge)](https://github.com/danishru/wled_liveviewproxy/releases/tag/v0.2.1)


## Основные возможности

- **Живой просмотр:**\
  Используя постоянное WebSocket-соединение, интеграция отображает текущую цветовую схему устройства в реальном времени на специальной графической карточке. Предпросмотр показывается в виде CSS-градиента, обновляющегося мгновенно.
  
   ![image](https://github.com/user-attachments/assets/f5bc0e22-cb83-40f1-a975-88f843e57ece)

- **Неограниченное количество просмотров:**\
  Теперь вы не ограничены одной WebSocket-сессией для просмотра LiveView WLED. Вы можете создавать сколько угодно сессий, количество сессий ограничено только ресурсами вашего Home Assistant. Количество используемых соединений отображается в специальном сенсоре вида «WLVP - {имя WLED}». Этот же сенсор показывает количество нативных WebSocket соединений самого устройства WLED.

- **Автоматическая настройка:**\
  Интеграция не требует сложных настроек. При добавлении устройства достаточно указать только IP-адрес. Всё остальное будет сделано автоматически.

- **Понятная карточка для Home Assistant:**\
  Карточка имеет удобный и простой интерфейс, наглядно демонстрирующий текущий эффект устройства WLED в реальном времени, аналогично функции «peek» из веб-интерфейса WLED.
  ![image](https://github.com/user-attachments/assets/38abe0f3-ff12-4dce-9930-2b6aa5eca9e6)

- **Безопасность и простота подключения:**\
  Вам не нужно настраивать nginx-прокси, перенаправлять порты на роутере или публиковать веб-интерфейс WLED в интернете. Всё работает безопасно внутри вашей домашней сети.

- **Режим контроля:**\
  Если включить режим контроля, обновления данных сенсора будут приходить мгновенно, также начнёт работать уведомление о доступности устройства. Для этого используется дополнительное WebSocket-соединение с устройством WLED. Также появится источник света с названием «WLVP - {имя WLED}», поддерживающий базовое управление (включение/выключение и регулировка яркости) через WebSocket.

  ![image](https://github.com/user-attachments/assets/2108b262-2b22-47be-8ba8-f2a24d821339)

- **Служба JSON API команд:**  
  При включённом **режиме управления (Control Mode)** вы можете отправлять [JSON API команды](https://kno.wled.ge/interfaces/json-api/) напрямую на устройства WLED с помощью специальной службы Home Assistant — `wled_liveviewproxy.send_command`. Эта служба особенно удобна в автоматизациях и скриптах, позволяя реализовать расширенное управление устройством, выходящее за рамки стандартной интеграции WLED.

  ![image](https://github.com/user-attachments/assets/a42ef8b6-9890-44de-9bed-6ebf6e3a7cd3)

## Установка

### Установка через HACS

**Убедитесь, что HACS установлен:**\
Если HACS ещё не установлен, следуйте [официальной инструкции по установке HACS](https://hacs.xyz/docs/use/).

#### Установка одним кликом

Для установки интеграции **WLED Live View Proxy** перейдите по ссылке ниже:

[![Open your Home Assistant instance and open a repository inside the Home Assistant Community Store.](https://my.home-assistant.io/badges/hacs_repository.svg)](https://my.home-assistant.io/redirect/hacs_repository/?owner=danishru&repository=wled_liveviewproxy&category=integration)

#### Обычная установка через HACS

1. **Откройте Home Assistant и перейдите в HACS:**\
   На боковой панели найдите и нажмите на значок HACS.
2. **Добавление пользовательского репозитория:**
   - В HACS перейдите на вкладку **Интеграции**.
   - Нажмите кнопку **Добавить пользовательский репозиторий** (Custom Repositories).
   - В появившемся окне введите URL репозитория:\
     `https://github.com/danishru/wled_liveviewproxy`
   - Выберите тип репозитория **Integration**.
   - Нажмите **Добавить**.
3. **Установка интеграции:**
   - После добавления репозитория HACS автоматически обнаружит релиз интеграции.
   - В разделе **Интеграции** появится интеграция с именем **WLED Live View Proxy**.
   - Найдите её и нажмите **Установить**.
   - Дождитесь завершения установки.

Теперь интеграция установлена и готова к использованию через HACS!

### Ручная установка (не рекомендуется)

1. Скопируйте папку `wled_liveviewproxy` в каталог `custom_components` вашей конфигурации Home Assistant.
2. Перезапустите Home Assistant.
3. Добавьте интеграцию через веб-интерфейс:
   - Перейдите в **Настройки → Интеграции**.
   - Нажмите **Добавить интеграцию** и выберите **WLED Live View Proxy**.
   - Укажите IP-адрес вашего WLED-устройства.

### Регистрация карточки

После установки интеграции дополнительно необходимо зарегистрировать карточку в панели управления ресурсами:

[![Open your Home Assistant instance and show your dashboard resources.](https://my.home-assistant.io/badges/lovelace_resources.svg)](https://my.home-assistant.io/redirect/lovelace_resources/) 
- Или перейдите в **Настройки → Панель управления → Ресурсы**.
- Добавьте новый ресурс с URL `/local/wled-ws-card.js` и укажите тип ресурса **module**.

## Конфигурация

Перейдите по ссылке ниже и следуйте инструкциям мастера настройки **WLED Live View Proxy**:

[![Open your Home Assistant instance and show an integration.](https://my.home-assistant.io/badges/integration.svg)](https://my.home-assistant.io/redirect/integration/?domain=wled_liveviewproxy)

Или откройте **Настройки → Интеграции** в Home Assistant, найдите `WLED Live View Proxy` и следуйте инструкциям мастера настройки.

![image](https://github.com/user-attachments/assets/47cd77c6-babc-48cd-a3bd-0ddcad6779d7)


## Настройка карточки

После минимальной конфигурации будет создан сенсор. Далее добавьте карточку на вашу панель — она отобразится как "WLED Live View Card". Карточка имеет простой и понятный интерфейс настройки и сразу показывает Live View первого обнаруженного сенсора. Вы можете легко выбрать нужный сенсор из выпадающего списка.  
Дополнительно доступна настройка **яркости** и **угла направления градиента**, отображаемого на карточке.  
Если возникают проблемы с отображением, включите Info Mode или Debug Mode, чтобы увидеть дополнительную информацию в консоли браузера.

> [!IMPORTANT]\
> Карточка использует `LitElement`, который по умолчанию импортируется с внешнего CDN.  
> Если карточка не загружается, это может быть связано с **недоступностью CDN** (например, из-за сетевых ограничений или отсутствия интернета). В таком случае вы можете изменить путь импорта в файле `wled-ws-card.js`, чтобы использовать локальную или встроенную версию LitElement. 
>
> **Важно:** Начиная с версии 0.2.2 эта проблема больше не актуальна, так как карточка теперь работает полностью офлайн и больше не зависит от CDN или внешних импортов.


![image](https://github.com/user-attachments/assets/4b82ed54-2a7c-44ca-97e7-cbef8c2dd7f8)

> [!TIP]  
> Стиль карточки можно изменить с помощью [lovelace-card-mod](https://github.com/thomasloven/lovelace-card-mod).  
> Пример круглой карточки с использованием Card Mod:
> ```yaml
> type: custom:wled-ws-card
> sensor: "<your_entity_id>"
> grid_options:
>   columns: 12
>   rows: 2
> card_mod:
>   style: |
>     ha-card {
>       height: 100px;
>       width: 100px;
>       border-radius: 100%;
>     }
> ```

## Служба JSON API команд

При включённом **режиме управления (Control Mode)** интеграция предоставляет доступ к специальной службе Home Assistant — `wled_liveviewproxy.send_command`, которая позволяет отправлять любые команды [WLED JSON API](https://kno.wled.ge/interfaces/json-api/) напрямую на устройство.

Эта служба особенно полезна в **автоматизациях** и **скриптах**, когда требуется точный контроль над эффектами, сегментами, пресетами или режимом ночника.  
Также она возвращает полное состояние устройства WLED (`state` + `info`), аналогично ответу от `/json/si`, если команда содержит ключ `"v": true`.  
В противном случае может быть возвращён простой ответ вида `{"success": true}`, в зависимости от типа команды.

> [!IMPORTANT]\
> Команда отправляется как есть — ключи не проверяются на валидность, и обработка ошибок отсутствует, даже если устройство вернёт некорректное или неполное состояние.

### Примеры

- **Включение ночника с эффектом затемнения:**
  ```yaml
  action: wled_liveviewproxy.send_command
  data:
    targets:
      device_id: "<your_device_id>"
      entity_id: "<your_entity_id>"
    command: {"nl":{"on":true,"dur":30,"mode":1}}
  ```

- **Ночник с симуляцией рассвета (mode 3) и возвратом состояния (`"v": true`):**
  ```yaml
  action: wled_liveviewproxy.send_command
  data:
    targets:
      device_id: "<your_device_id>"
      entity_id: "<your_entity_id>"
    command: {"nl":{"on":true,"dur":45,"mode":3,"tbri":255},"v":true}
  ```

- **Активация эффекта на сегменте 1 с заморозкой, пользовательскими цветами и палитрой 0:**
  ```yaml
  action: wled_liveviewproxy.send_command
  data:
    targets:
      device_id: "<your_device_id>"
      entity_id: "<your_entity_id>"
    command: {"seg":[{"id":1,"on":true,"col":["ffffff","000000"],"frz":true,"fx":25,"pal":0,"bri":255}]}
  ```

- **Индивидуальное освещение по сегментам:**
  ```yaml
  action: wled_liveviewproxy.send_command
  data:
    targets:
      device_id: "<your_device_id>"
      entity_id: "<your_entity_id>"
    command: {"seg":[{"id":0,"on":true,"fx":71,"col":["ff00ff"]},{"id":1,"on":true,"fx":78,"bri":200,"col":["0000ff","00ffc8"],"sx":150}]}
  ```

> [!TIP]  
> В поле `targets` можно указывать как `device_id`, так и `entity_id`. Служба автоматически определит нужное устройство и отправит на него команду.


## Как работает?

Интеграция напрямую подключается к устройству WLED через локальную сеть, создавая специальный WebSocket-канал. Этот канал обеспечивает передачу данных о текущем эффекте в реальном времени. Данные затем преобразуются в наглядный CSS-градиент и отображаются на графической карточке в Home Assistant. Такой подход обеспечивает высокую скорость обновления и удобство использования: вы сразу видите изменения и не беспокоитесь о настройке внешних сервисов.

## Производительность, оптимизация и безопасность

Эта интеграция была создана при помощи искусственного интеллекта, и хотя я не являюсь профессиональным программистом, я понимаю, как работает этот код и какую задачу он решает. Код может быть не самым оптимальным или эффективным, и возможно, у вас есть идеи, как улучшить его. Присоединяйтесь к разработке, отправляйте pull request и помогите сделать интеграцию лучше!

Что касается безопасности — подключение к WebSocket в Home Assistant генерируется на основе уникального entry\_id, а сам канал передаёт только строку CSS-градиента, что делает его использование достаточно безопасным.

## Мотивация

Эта интеграция была создана из личной потребности — хотелось видеть превью своей WLED-гирлянды прямо из интерфейса Home Assistant, причём доступ к ней должен был быть из любой точки мира. Стандартный интерфейс WLED работает только по HTTP, а использование карточки iframe в Home Assistant не позволяет безопасно встраивать HTTP-контент в HTTPS-интерфейс. Поэтому появилась идея создать websocket-прокси, который безопасно передавал бы данные через Home Assistant.

Интеграция была разработана с помощью ChatGPT, а дизайн карточки вдохновлён стандартными карточками Home Assistant, чтобы обеспечить максимально родной и естественный внешний вид.

Буду рад вашим предложениям и идеям по улучшению интеграции — оставляйте запросы через issue. Если интеграция вам понравилась или оказалась полезной, поставьте звездочку репозиторию, это поможет привлечь к проекту больше внимания!

<!-- Определения ссылок для бейджей -->
[releases-shield]: https://img.shields.io/github/release/danishru/wled_liveviewproxy.svg?style=for-the-badge
[releases]: https://github.com/danishru/wled_liveviewproxy/releases
[commits-shield]: https://img.shields.io/github/commit-activity/m/danishru/wled_liveviewproxy.svg?style=for-the-badge
[commits]: https://github.com/danishru/wled_liveviewproxy/commits
[download-shield]: https://img.shields.io/github/downloads/danishru/wled_liveviewproxy/total.svg?style=for-the-badge
[downloads]: https://github.com/danishru/wled_liveviewproxy/releases
[license-shield]: https://img.shields.io/github/license/danishru/wled_liveviewproxy.svg?style=for-the-badge
[license]: https://github.com/danishru/wled_liveviewproxy/blob/master/LICENSE
[hacsbadge]: https://img.shields.io/badge/HACS-Custom-orange.svg?style=for-the-badge
[hacs]: https://hacs.xyz/
