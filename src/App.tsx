import { Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import { ErrorBoundary } from './components/ErrorBoundary';
import Home from './pages/Home';
import Cloud from './pages/Cloud';
import Experience from './pages/Experience';
import Timeline from './pages/Timeline';
import Graph from './pages/Graph';
import Settings from './pages/Settings';

export default function App() {
  return (
    <ErrorBoundary>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<ErrorBoundary><Home /></ErrorBoundary>} />
          <Route path="/cloud/:cloudType" element={<ErrorBoundary><Cloud /></ErrorBoundary>} />
          <Route path="/experience/:id" element={<ErrorBoundary><Experience /></ErrorBoundary>} />
          <Route path="/timeline" element={<ErrorBoundary><Timeline /></ErrorBoundary>} />
          <Route path="/graph" element={<ErrorBoundary><Graph /></ErrorBoundary>} />
          <Route path="/settings" element={<ErrorBoundary><Settings /></ErrorBoundary>} />
        </Route>
      </Routes>
    </ErrorBoundary>
  );
}
