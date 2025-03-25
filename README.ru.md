[![GitHub Release][releases-shield]][releases]
[![GitHub Activity][commits-shield]][commits]
[![Downloads][download-shield]][Downloads]
[![License][license-shield]][license]
[![HACS Custom][hacsbadge]][hacs]

# WLED Live View Proxy for Home Assistant

## О проекте

**WLED Live View Proxy** — интеграция для Home Assistant, которая позволяет видеть живой предпросмотр устройства WLED прямо на панели управления. Интеграция проста в использовании и настраивается автоматически: достаточно просто указать IP-адрес устройства, и интеграция сама подключится и настроит всё необходимое.

> [!IMPORTANT]\
> Эта интеграция создана при помощи ChatGPT для совместного написания кода, исправления ошибок и редактуры. Если вы придерживаетесь иной точки зрения относительно использования инструментов искусственного интеллекта, прошу принять это во внимание. Я считаю такое применение приемлемым, поскольку интеграция некоммерческая, открытая и бесплатная, и её цель — улучшить взаимодействие и удобство использования Home Assistant.

## Основные возможности

- **Живой просмотр:**\
  Используя постоянное WebSocket-соединение, интеграция отображает текущую цветовую схему устройства в реальном времени на специальной графической карточке. Предпросмотр показывается в виде CSS-градиента, обновляющегося мгновенно.

- **Неограниченное количество просмотров:**\
  Теперь вы не ограничены одной WebSocket-сессией для просмотра LiveView WLED. Вы можете создавать сколько угодно сессий, количество сессий ограничено только ресурсами вашего Home Assistant. Количество используемых соединений отображается в специальном сенсоре вида «WLVP - {имя WLED}». Этот же сенсор показывает количество нативных WebSocket соединений самого устройства WLED.

- **Автоматическая настройка:**\
  Интеграция не требует сложных настроек. При добавлении устройства достаточно указать только IP-адрес. Всё остальное будет сделано автоматически.

- **Понятная карточка для Home Assistant:**\
  Карточка имеет удобный и простой интерфейс, наглядно демонстрирующий текущий эффект устройства WLED в реальном времени, аналогично функции «peek» из веб-интерфейса WLED.

- **Безопасность и простота подключения:**\
  Вам не нужно настраивать nginx-прокси, перенаправлять порты на роутере или публиковать веб-интерфейс WLED в интернете. Всё работает безопасно внутри вашей домашней сети.

- **Режим контроля:**\
  Если включить режим контроля, обновления данных сенсора будут приходить мгновенно, также начнёт работать уведомление о доступности устройства. Для этого используется дополнительное WebSocket-соединение с устройством WLED. Также появится источник света с названием «WLVP - {имя WLED}», поддерживающий базовое управление (включение/выключение и регулировка яркости) через WebSocket.

## Установка

### Ручная установка

1. Скопируйте папку `wled_liveviewproxy` в каталог `custom_components` вашей конфигурации Home Assistant.
2. Перезапустите Home Assistant.
3. Добавьте интеграцию через веб-интерфейс:
   - Перейдите в **Настройки → Интеграции**.
   - Нажмите **Добавить интеграцию** и выберите **WLED Live View Proxy**.
   - Укажите IP-адрес вашего WLED-устройства.

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

### Регистрация карточки

После установки интеграции дополнительно необходимо зарегистрировать карточку в панели управления ресурсами:

[![Open your Home Assistant instance and show your dashboard resources.](https://my.home-assistant.io/badges/lovelace_resources.svg)](https://my.home-assistant.io/redirect/lovelace_resources/) 
- Или перейдите в **Настройки → Панель управления → Ресурсы**.
- Добавьте новый ресурс с URL `/local/wled-ws-card.js` и укажите тип ресурса **module**.

## Конфигурация

Перейдите по ссылке ниже и следуйте инструкциям мастера настройки **WLED Live View Proxy**:

[![Open your Home Assistant instance and show an integration.](https://my.home-assistant.io/badges/integration.svg)](https://my.home-assistant.io/redirect/integration/?domain=wled_liveviewproxy)

Или откройте **Настройки → Интеграции** в Home Assistant, найдите `WLED Live View Proxy` и следуйте инструкциям мастера настройки.

## Как работает?

Интеграция напрямую подключается к устройству WLED через локальную сеть, создавая специальный WebSocket-канал. Этот канал обеспечивает передачу данных о текущем эффекте в реальном времени. Данные затем преобразуются в наглядный CSS-градиент и отображаются на графической карточке в Home Assistant. Такой подход обеспечивает высокую скорость обновления и удобство использования: вы сразу видите изменения и не беспокоитесь о настройке внешних сервисов.

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
