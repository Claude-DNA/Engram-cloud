import { Routes, Route } from "react-router-dom";
import Layout from "./components/Layout";
import Home from "./pages/Home";
import Cloud from "./pages/Cloud";
import Experience from "./pages/Experience";
import Timeline from "./pages/Timeline";
import Settings from "./pages/Settings";

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<Home />} />
        <Route path="/cloud/:cloudType" element={<Cloud />} />
        <Route path="/experience/:id" element={<Experience />} />
        <Route path="/timeline" element={<Timeline />} />
        <Route path="/settings" element={<Settings />} />
      </Route>
    </Routes>
  );
}
