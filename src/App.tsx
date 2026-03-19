import { useEffect, useRef } from 'react';
import { Routes, Route } from 'react-router-dom';
import { listen } from '@tauri-apps/api/event';
import Layout from './components/Layout';
import { ErrorBoundary } from './components/ErrorBoundary';
import Home from './pages/Home';
import Cloud from './pages/Cloud';
import Experience from './pages/Experience';
import Timeline from './pages/Timeline';
import Graph from './pages/Graph';
import Settings from './pages/Settings';
import LockScreen from './views/LockScreen';
import OnboardingPassphrase from './views/OnboardingPassphrase';
import { useAuthStore } from './stores/authStore';

export default function App() {
  const isLocked = useAuthStore((s) => s.isLocked);
  const isFirstLaunch = useAuthStore((s) => s.isFirstLaunch);
  const initialize = useAuthStore((s) => s.initialize);
  const resetActivity = useAuthStore((s) => s.resetActivity);
  const lock = useAuthStore((s) => s.lock);

  const blurTimeRef = useRef(0);

  // Initialise auth state once on mount
  useEffect(() => {
    initialize();
  }, [initialize]);

  // Track user activity for idle-lock timeout
  useEffect(() => {
    const events = ['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll'];
    const handler = () => resetActivity();
    events.forEach((e) => window.addEventListener(e, handler, { passive: true }));
    return () => events.forEach((e) => window.removeEventListener(e, handler));
  }, [resetActivity]);

  // Auto-lock on window blur >60 seconds
  useEffect(() => {
    let cleanup: (() => void) | undefined;

    const setup = async () => {
      const unBlur = await listen('tauri://blur', () => {
        blurTimeRef.current = Date.now();
      });
      const unFocus = await listen('tauri://focus', () => {
        if (blurTimeRef.current > 0 && Date.now() - blurTimeRef.current > 60_000) {
          lock();
        }
      });
      cleanup = () => {
        unBlur();
        unFocus();
      };
    };

    setup();
    return () => cleanup?.();
  }, [lock]);

  if (isFirstLaunch) {
    return <OnboardingPassphrase />;
  }

  if (isLocked) {
    return <LockScreen />;
  }

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
