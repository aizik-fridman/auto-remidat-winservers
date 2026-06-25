import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import AllServersPage from "./pages/AllServersPage";
import ConsolePage from "./pages/ConsolePage";
import ResetPage from "./pages/ResetPage";

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
