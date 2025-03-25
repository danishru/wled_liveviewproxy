[![GitHub Release][releases-shield]][releases]
[![GitHub Activity][commits-shield]][commits]
[![Downloads][download-shield]][downloads]
[![License][license-shield]][license]
[![HACS Custom][hacsbadge]][hacs]

# WLED Live View Proxy for Home Assistant

## About

**WLED Live View Proxy** is a Home Assistant integration that allows you to see a live preview of your WLED device directly on your Home Assistant dashboard. The integration is user-friendly and automatically configured: simply specify the IP address of your device, and the integration will handle the rest.

> [!IMPORTANT]\
> This integration was created with the help of ChatGPT for collaborative code writing, debugging, and editing. If you hold different views on using AI tools, please consider this. I believe this use is acceptable because the integration is non-commercial, open-source, free, and its goal is to enhance interaction and usability within Home Assistant.

## Main features

- **Live Preview:**\
  Using a persistent WebSocket connection, the integration displays the current color scheme of your WLED device in real-time through a dedicated graphical card. The preview is shown as a CSS gradient that updates instantly.

- **Unlimited View Sessions:**\
  You're no longer limited to a single WebSocket session for viewing WLED LiveView. You can create as many sessions as your Home Assistant resources allow. The number of active connections is displayed in a dedicated sensor named "WLVP - {WLED name}". This sensor also shows the number of native WebSocket connections of the WLED device itself.

- **Automatic Configuration:**\
  The integration doesn't require complex setup. When adding a device, you only need to provide the IP address. Everything else is configured automatically.

- **User-Friendly Card for Home Assistant:**\
  The card has a user-friendly interface clearly showing the current WLED effect in real-time, similar to the "peek" feature in the WLED web interface.

- **Secure and Simple Connection:**\
  You don't need to set up nginx proxies, router port forwarding, or publish the WLED web interface online. Everything operates securely within your local network.

- **Control Mode:**\
  Enabling control mode updates sensor data instantly and activates device availability notifications. This uses an additional WebSocket connection to your WLED device. It also adds a light entity named "WLVP - {WLED name}", supporting basic operations (on/off and brightness adjustment) via WebSocket.

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

## How it works

The integration directly connects to your WLED device via the local network, creating a dedicated WebSocket channel. This channel transmits real-time effect data. The data is then converted into a clear CSS gradient displayed on a graphical card in Home Assistant. This approach ensures fast updates and ease of use: you instantly see changes without needing external service configurations.

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

