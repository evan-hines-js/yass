/* @refresh reload */
import { render } from "solid-js/web";
import { Router } from "@solidjs/router";
import Layout from "./components/Layout";
import Dashboard from "./pages/Dashboard";
import Inventory from "./pages/Inventory";
import Tasks from "./pages/Tasks";
import Calendar from "./pages/Calendar";
import Restock from "./pages/Restock";
import AuditLog from "./pages/AuditLog";
import Import from "./pages/Import";
import "./app.css";

render(
  () => (
    <Router
      root={Layout}
      children={[
        { path: "/", component: Dashboard },
        { path: "/inventory", component: Inventory },
        { path: "/restock", component: Restock },
        { path: "/tasks", component: Tasks },
        { path: "/calendar", component: Calendar },
        { path: "/import", component: Import },
        { path: "/audit", component: AuditLog },
      ]}
    />
  ),
  document.getElementById("app")!
);
