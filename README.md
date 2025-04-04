[![GitHub Release][releases-shield]][releases]
[![GitHub Activity][commits-shield]][commits]
[![Downloads][download-shield]][downloads]
[![License][license-shield]][license]
[![HACS Custom][hacsbadge]][hacs]

# WLED Live View Proxy for Home Assistant

## About

[README на русском тут 👈](https://github.com/danishru/wled_liveviewproxy/blob/main/README.ru.md)

**WLED Live View Proxy** is a Home Assistant integration that allows you to see a live preview of your WLED device directly on your Home Assistant dashboard. The integration is user-friendly and automatically configured: simply specify the IP address of your device, and the integration will handle the rest.


https://github.com/user-attachments/assets/ae4ff0ef-f80a-408f-a198-dcd9a109cdf4


> [!IMPORTANT]\
> This integration was created with the help of ChatGPT for collaborative code writing, debugging, and editing. If you hold different views on using AI tools, please consider this. I believe this use is acceptable because the integration is non-commercial, open-source, free, and its goal is to enhance interaction and usability within Home Assistant.

## 🆕 What’s New in v0.2.1

### ✨ New Features
- **🧠 [JSON API Command Service](https://github.com/danishru/wled_liveviewproxy#json-api-command-service)**  
  Added `wled_liveviewproxy.send_command` — a new service for sending JSON commands via WebSocket with **optional full state return**.
  
- **🎛️ Gradient Rotation Support**  
  The `wled-ws-card.js` card now supports rotating the gradient direction directly in its config.

### 🔄 Updates
- Debug logging improved, WebSocket command handling optimized, and LitElement CDN updated with styling fixes.

[![Read full release notes for v0.2.1](https://img.shields.io/badge/Read--release--notes-v0.2.1-blue?style=for-the-badge)](https://github.com/danishru/wled_liveviewproxy/releases/tag/v0.2.1)


## Main features

- **Live Preview:**  
  Using a persistent WebSocket connection, the integration displays the current color scheme of your WLED device in real-time through a dedicated graphical card. The preview is shown as a CSS gradient that updates instantly. Additionally, the card supports adjusting gradient brightness and direction.

   ![image](https://github.com/user-attachments/assets/f5bc0e22-cb83-40f1-a975-88f843e57ece)

- **Unlimited View Sessions:**\
  You're no longer limited to a single WebSocket session for viewing WLED LiveView. You can create as many sessions as your Home Assistant resources allow. The number of active connections is displayed in a dedicated sensor named "WLVP - {WLED name}". This sensor also shows the number of native WebSocket connections of the WLED device itself.

- **Automatic Configuration:**\
  The integration doesn't require complex setup. When adding a device, you only need to provide the IP address. Everything else is configured automatically.

- **User-Friendly Card for Home Assistant:**\
  The card has a user-friendly interface clearly showing the current WLED effect in real-time, similar to the "peek" feature in the WLED web interface.

  ![image](https://github.com/user-attachments/assets/38abe0f3-ff12-4dce-9930-2b6aa5eca9e6)

- **Secure and Simple Connection:**\
  You don't need to set up nginx proxies, router port forwarding, or publish the WLED web interface online. Everything operates securely within your local network.

- **Control Mode:**\
  Enabling control mode updates sensor data instantly and activates device availability notifications. This uses an additional WebSocket connection to your WLED device. It also adds a light entity named "WLVP - {WLED name}", supporting basic operations (on/off and brightness adjustment) via WebSocket.
  
  ![image](https://github.com/user-attachments/assets/2108b262-2b22-47be-8ba8-f2a24d821339)

- **JSON API Command Service:**  
  When **Control Mode** is enabled, you can send direct [JSON API commands](https://kno.wled.ge/interfaces/json-api/) to your WLED devices using the dedicated Home Assistant service `wled_liveviewproxy.send_command`. This service is particularly convenient for use in automations and scripts, allowing advanced device control and functionality beyond the standard capabilities of the official WLED integration.

  ![image](https://github.com/user-attachments/assets/a42ef8b6-9890-44de-9bed-6ebf6e3a7cd3)

## Installation

### Manual Installation

1. Copy the `wled_liveviewproxy` folder into the `custom_components` directory of your Home Assistant configuration.
2. Restart Home Assistant.
3. Add the integration via the web interface:
   - Navigate to **Settings → Integrations**.
   - Click **Add Integration** and select **WLED Live View Proxy**.
   - Enter the IP address of your WLED device.

### Installation via HACS

**Make sure HACS is installed:**\
If HACS is not yet installed, follow the [official HACS installation instructions](https://hacs.xyz/docs/use/).

#### One-click Installation

To install **WLED Live View Proxy**, follow the link below:

[![Open your Home Assistant instance and open a repository inside the Home Assistant Community Store.](https://my.home-assistant.io/badges/hacs_repository.svg)](https://my.home-assistant.io/redirect/hacs_repository/?owner=danishru&repository=wled_liveviewproxy&category=integration)

#### Regular Installation via HACS

1. **Open Home Assistant and go to HACS:**\
   On the sidebar, find and click the HACS icon.
2. **Add Custom Repository:**
   - In HACS, go to the **Integrations** tab.
   - Click **Add Custom Repository**.
   - In the popup, enter the repository URL:\
     `https://github.com/danishru/wled_liveviewproxy`
   - Select repository type **Integration**.
   - Click **Add**.
3. **Install Integration:**
   - After adding the repository, HACS will automatically detect the integration release.
   - The integration named **WLED Live View Proxy** will appear in the **Integrations** section.
   - Find it and click **Install**.
   - Wait for the installation to complete.

The integration is now installed and ready to use via HACS!

### Card Registration

After installing the integration, you must additionally register the card in the dashboard resources:

[![Open your Home Assistant instance and show your dashboard resources.](https://my.home-assistant.io/badges/lovelace_resources.svg)](https://my.home-assistant.io/redirect/lovelace_resources/)
- Or navigate to **Settings → Dashboards → Resources**.
- Add a new resource with the URL `/local/wled-ws-card.js` and set the resource type to **module**.

## Configuration

Click the link below and follow the configuration wizard instructions for **WLED Live View Proxy**:

[![Open your Home Assistant instance and show an integration.](https://my.home-assistant.io/badges/integration.svg)](https://my.home-assistant.io/redirect/integration/?domain=wled_liveviewproxy)

Or open **Settings → Integrations** in Home Assistant, find `WLED Live View Proxy`, and follow the setup wizard instructions.

![image](https://github.com/user-attachments/assets/47cd77c6-babc-48cd-a3bd-0ddcad6779d7)

## Card Setup

Once minimally configured, a sensor will be created. Next, add the card to your dashboard—it'll appear as "WLED Live View Card". The card features a simple and clear configuration interface, immediately displaying the Live View of the first sensor listed. You can easily select your desired sensor in the provided field. Additionally, you can adjust the gradient brightness. If you encounter issues, enable Info Mode or Debug Mode to view extra information in the browser console. 

> [!IMPORTANT]\
> The card uses `LitElement`, imported from an external CDN by default. If the card fails to load, it may be due to **CDN unavailability** (e.g., network restrictions or offline access). In this case, you can modify the import path in the `wled-ws-card.js` file to use a local or bundled version of LitElement.

![image](https://github.com/user-attachments/assets/4b82ed54-2a7c-44ca-97e7-cbef8c2dd7f8)

> [!TIP]
> The card’s style can be customized with [lovelace-card-mod](https://github.com/thomasloven/lovelace-card-mod).
> Example of a round card using Card Mod:
> ```yaml
>type: custom:wled-ws-card
>sensor: "<your_entity_id>"
>grid_options:
>  columns: 12
>  rows: 2
>card_mod:
>  style: |
>    ha-card {
>      height: 100px;
>      width: 100px;
>      border-radius: 100%;
>    }
>```


> [!TIP]
>You can also try the card quickly by importing the demo dashboard configuration from  
>[`docs/demo.yaml`](https://github.com/danishru/wled_liveviewproxy/blob/main/docs/demo.yaml) available in the repository.


## JSON API Command Service

When **Control Mode** is enabled, the integration provides access to a special Home Assistant service `wled_liveviewproxy.send_command`, which allows you to send any [WLED JSON API](https://kno.wled.ge/interfaces/json-api/) command directly to your device.

This service is especially useful in **automations** and **scripts**, where you need precise control over effects, segments, presets, or Nightlight mode. It also returns the full WLED state (`state` + `info`), just like a `/json/si` response — if the command includes `"v": true`.  
Otherwise, the response may be a simple `{"success": true}` depending on the type of command.  

> [!IMPORTANT]\
> The command is sent as-is — keys are not validated, and there is no error handling if the device responds with an invalid or partial state.

### Examples

- **Activate Nightlight with fade effect:**
  ```yaml
  action: wled_liveviewproxy.send_command
  data:
    targets:
      device_id: "<your_device_id>"
      entity_id: "<your_entity_id>"
    command: {"nl":{"on":true,"dur":30,"mode":1}}
  ```

- **Nightlight with sunrise simulation (mode 3) + return full state (`"v": true`):**
  ```yaml
  action: wled_liveviewproxy.send_command
  data:
    targets:
      device_id: "<your_device_id>"
      entity_id: "<your_entity_id>"
    command: {"nl":{"on":true,"dur":45,"mode":3,"tbri":255},"v":true}
  ```

- **Activate effect on segment 1 with freeze, custom colors, and palette 0:**
  ```yaml
  action: wled_liveviewproxy.send_command
  data:
    targets:
      device_id: "<your_device_id>"
      entity_id: "<your_entity_id>"
    command: {"seg":[{"id":1,"on":true,"col":["ffffff","000000"],"frz":t,"fx":25,"pal":0,"bri":255}]}
  ```

- **Custom lighting per segment:**
  ```yaml
  action: wled_liveviewproxy.send_command
  data:
    targets:
      device_id: "<your_device_id>"
      entity_id: "<your_entity_id>"
    command: {"seg":[{"id":0,"on":true,"fx":71,"col":["ff00ff"]},{"id":1,"on":true,"fx":78,"bri":200,"col":["0000ff","00ffc8"],"sx":150}]}
  ```

> [!TIP]
> You can use both `device_id` and `entity_id` in the `targets` field. The service will automatically resolve and dispatch the command to the correct device.


## How it works

The integration directly connects to your WLED device via the local network, creating a dedicated WebSocket channel. This channel transmits real-time effect data. The data is then converted into a clear CSS gradient displayed on a graphical card in Home Assistant. This approach ensures fast updates and ease of use: you instantly see changes without needing external service configurations.

## Performance, Optimization, and Security

This integration was built with AI assistance, and while I'm not a professional programmer, I understand how this code works and what it achieves. The code might not be fully optimized, and you might have suggestions for improvement. Please join the development, submit pull requests, and help improve the integration!

Regarding security—the WebSocket connection in Home Assistant is generated based on a unique entry_id, and the channel transmits only a CSS gradient string, making its use secure.

## Motivation

This integration was born from a personal need—I wanted a live preview of my WLED light string right from the Home Assistant interface, accessible from anywhere in the world. The standard WLED interface operates over HTTP only, and using an iframe card in Home Assistant doesn't securely embed HTTP content into an HTTPS interface. Thus, the idea emerged to create a WebSocket proxy that securely transmits data through Home Assistant.

The integration was developed with the help of ChatGPT, and the card design was inspired by standard Home Assistant cards, ensuring it feels native and intuitive.

I welcome your suggestions and ideas for improving the integration—please leave your requests via issues. If you liked the integration or found it useful, please star the repository to help increase its visibility!

<!-- Badge link definitions -->
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

