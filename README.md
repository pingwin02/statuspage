# Node.js Status Page

A lightweight, fully featured, and secure status page and administration dashboard. Designed to replace legacy bash scripts and heavy external monitoring solutions by keeping everything simple and local.

## Features

- **Multi-protocol Monitoring:** Check the status of your services via HTTP(S) (mandates `200 OK`), ICMP Ping, or TCP Port (`nc`). You can also manually override the status for any service.
- **Incident Management:** Inform your users about ongoing maintenance or past outages. Incidents are chronologically sorted and automatically divided into "Active" and "Archive" based on their end dates.
- **Secure Admin Panel:** Built-in web interface for creating checks and managing incidents. Uses secure sessions and `bcrypt` hashed passwords.
- **First-time Setup Wizard:** The application dynamically detects if it's running for the first time and will prompt you to set a secure admin password—meaning no plaintext passwords in your config.
- **API Response Caching:** The backend caches check results for 5 minutes, significantly reducing the load on the host machine and preventing accidental DDoS scenarios from high traffic.
- **Flat-file JSON Storage:** Zero external databases required. All settings, incidents, and checks are saved securely inside `data/config.json`.
- **Modern Dark UI:** Beautiful, responsive dark mode utilizing a heavily customized Materialize CSS layout, featuring SortableJS for drag-and-drop ordering in the admin panel.
- **Localization:** The public dashboard supports language toggling (English / Polish) directly on the client side.

## Prerequisites

- **Node.js** (v14 or newer recommended)
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
5. **Adding Incidents:** You can describe ongoing issues or track resolved ones. Setting an "End date" will automatically move the incident to the "Archive" tab once the date passes.

## License

See the `LICENSE` file for more details.

## Acknowledgements

This project builds upon the concepts of [tinystatus](https://github.com/bderenzo/tinystatus).
