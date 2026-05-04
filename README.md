# Status Page

A lightweight and secure status page and administration dashboard. Designed to replace legacy bash scripts by keeping everything simple and local.

## Features

- **Multi-protocol Monitoring:** HTTP(S), ICMP Ping, TCP Port checks, or manual status override.
- **Outage Management:** Chronologically sorted, auto-divided into "Active" and "Archive".
- **Secure Admin Panel:** Bcrypt hashed passwords, secure sessions.
- **Flat-file JSON Storage:** Zero databases—all data in `data/config.json`.
- **Timezone-aware Display:** Visitor timezone conversion with timezone labels.
- **Bootstrap 5 Dark UI:** Responsive, beautiful dark mode.
- **Localization:** English / Polish language toggle.

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
5. **Adding Outages:** You can describe ongoing issues or track resolved ones. Setting an "End date" will automatically move the outage to the "Archive" tab once the date passes.
   - Outage timestamps are stored with the config timezone and shown on the public page in the visitor's timezone.

## License

See the `LICENSE` file for more details.

## Acknowledgements

This project builds upon the concepts of [tinystatus](https://github.com/bderenzo/tinystatus).
