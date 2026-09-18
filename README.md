# Status Page

A lightweight and secure status page and administration dashboard. Designed to replace legacy bash scripts by keeping everything simple and local.

## Features

- **Multi-protocol Monitoring:** HTTP(S), ICMP Ping, TCP Port checks, or manual status override.
- **Outage Management:** Chronologically sorted, auto-divided into "Active" and "Archive".
- **Progressive Real-Time Status Streaming:** Server-Sent Events (SSE) stream status check updates progressively as each individual service check resolves, eliminating waiting for all checks to finish.
- **Group-Centric Check Management:** Dedicated group containers in the admin panel with intuitive "Add group" and "Add check" actions, drag-and-drop reordering, and clean check rows without redundant group inputs.
- **Instant 5-Minute Caching:** Cached checks are served immediately for 5 minutes to prevent redundant requests, refreshing cleanly in the background once the cache period expires or when returning to the dashboard after editing in the admin panel.
- **Cache-First & Progressive Live Checks:** Cached statuses are served immediately when cache is valid (providing a smooth 0.5s visual loading confirmation across all service pills on reload or manual refresh); when checks run (after cache expiration or returning to dashboard after configuration changes), manual checks display immediately, live network checks start in loading state, the refresh button is locked, and services resolve progressively in real time without queuing or repeated runs.
- **Immediate Refresh Cancellation & Dashboard Redirect:** Entering the admin panel or saving configuration immediately aborts any in-flight background checks, and saving configuration redirects immediately to the dashboard to monitor updates.
- **Safe Configuration Updates:** Admin updates to outages and checks are saved safely without background interference or duplicate runs.
- **Secure Admin Panel:** Bcrypt hashed passwords, secure sessions.
- **Flat-file JSON Storage:** Zero databases—all data in `data/config.json`.
- **Timezone Selection & Timezone-aware Display:** Configurable timezone selector with automatic browser detection in the admin panel and visitor timezone conversion with timezone labels.
- **Live Relative Timestamps:** Relative outage timestamps update automatically every second without reloading the page.
- **Dynamic SVG Status Favicon:** Real-time 3D spherical vector favicon reflecting system operational health (operational green, outage red, and loading grey).
- **Bootstrap 5 Dark UI:** Responsive, beautiful dark mode.
- **Localization:** Instant in-place English / Polish language toggle without page reloads, status refetches, or fake loading.

## Prerequisites

- **Node.js** (v18 or newer recommended)
- **`ping`** (for ping checks)
- **`nc` (netcat)** (for port checks)

## Installation

1. Clone or download the repository.
2. Install dependencies:
   ```bash
   npm install
   ```
3. Start the application:
   ```bash
   node app.js
   ```
   _(Optionally, use `nodemon` or `pm2` for process management)._

## Usage & Configuration

1. **Dashboard:** Navigate to `http://localhost:3000/` to view the public-facing status page.
2. **Admin Panel:** Navigate to `http://localhost:3000/panel` (or click the hidden link on the timestamp footer in the public view).
3. **First-time login:** Upon loading the `/panel` for the first time, you will be prompted to create a new Administrator Password.
4. **Adding Checks:** Inside the admin panel, you can add new hosts. Choose between HTTP, Ping, Port, or Manual check types.
   - For **Port** checks, input the host and port separated by a space (e.g., `localhost 3306`).
   - For **HTTP** checks, input the full URL (e.g., `https://example.com`).
5. **Adding Outages:** You can describe ongoing issues or track resolved ones. Setting an "End date" displays as an expected end for active outages, or as the outage end once the date passes (moving the outage to the "Archive" tab).
   - Outage timestamps are stored with the config timezone and shown on the public page in the visitor's timezone.
6. **Configuring Timezone:** Select the status page timezone directly in the admin panel dropdown or click "Browser timezone" to auto-detect your local timezone.

## License

See the `LICENSE` file for more details.

## Acknowledgements

This project builds upon the concepts of [tinystatus](https://github.com/bderenzo/tinystatus).
