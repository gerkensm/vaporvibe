import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";

import { NotificationsProvider } from "./components/Notifications";
import AdminDashboard from "./pages/AdminDashboard";
import SetupWizard from "./pages/SetupWizard";

import "./components/Notifications.css";

export function App() {
  return (
    <NotificationsProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<SetupWizard />} />
          <Route path="/__setup" element={<SetupWizard />} />
          <Route path="/serve-llm" element={<AdminDashboard mode="admin" />} />
          <Route path="/serve-llm/*" element={<AdminDashboard mode="admin" />} />
          <Route path="*" element={<Navigate to="/serve-llm" replace />} />
        </Routes>
      </BrowserRouter>
    </NotificationsProvider>
  );
}

export default App;
