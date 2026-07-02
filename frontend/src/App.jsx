import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import AllServersPage from "./pages/AllServersPage.jsx";
import ResetPage from "./pages/ResetPage.jsx";
import ConsolePage from "./pages/ConsolePage.jsx";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/all-servers" replace />} />
        <Route path="/all-servers" element={<AllServersPage />} />
        <Route path="/reset/:hostname" element={<ResetPage />} />
        <Route path="/console/:hostname" element={<ConsolePage />} />
        <Route path="*" element={<Navigate to="/all-servers" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
