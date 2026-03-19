import { useEffect, useRef, useState, useCallback } from 'react';
import { Routes, Route, useNavigate } from 'react-router-dom';
import { listen } from '@tauri-apps/api/event';
import { register, unregisterAll } from '@tauri-apps/plugin-global-shortcut';
import { os } from '@tauri-apps/api';
import Layout from './components/Layout';
import { ErrorBoundary } from './components/ErrorBoundary';
import QuickCaptureModal from './components/QuickCaptureModal';
import Home from './pages/Home';
import Cloud from './pages/Cloud';
import Experience from './pages/Experience';
import Timeline from './pages/Timeline';
import Graph from './pages/Graph';
import Settings from './pages/Settings';
import ImportView from './views/ImportView';
import ReviewView from './views/ReviewView';
import LockScreen from './views/LockScreen';
import OnboardingPassphrase from './views/OnboardingPassphrase';
import { useAuthStore } from './stores/authStore';
import {
  registerDeeplinkHandler,
  deeplinkToRouterPath,
  type DeeplinkRoute,
} from './lib/deeplink';

export default function App() {
  const isLocked = useAuthStore((s) => s.isLocked);
  const isFirstLaunch = useAuthStore((s) => s.isFirstLaunch);
  const initialize = useAuthStore((s) => s.initialize);
  const resetActivity = useAuthStore((s) => s.resetActivity);
  const lock = useAuthStore((s) => s.lock);

  const blurTimeRef = useRef(0);
  const [quickCaptureOpen, setQuickCaptureOpen] = useState(false);
  const navigateRef = useRef<ReturnType<typeof useNavigate> | null>(null);

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

  // macOS: global hotkey + deep-link registration (only when unlocked)
  useEffect(() => {
    if (isLocked || isFirstLaunch) return;

    let cleanupDeeplink: (() => void) | undefined;
    let hotkeyRegistered = false;

    const setup = async () => {
      // Only register macOS-specific features on macOS
      let platform = 'unknown';
      try {
        platform = await os.platform();
      } catch {
        // Not in Tauri context (tests)
        return;
      }

      if (platform !== 'macos') return;

      // 1. Global hotkey: Cmd+Shift+E → Quick Capture
      try {
        await register('CmdOrCtrl+Shift+E', () => {
          setQuickCaptureOpen(true);
        });
        hotkeyRegistered = true;
      } catch {
        // Hotkey may already be registered or unavailable
      }

      // 2. Deep-link handler
      try {
        cleanupDeeplink = await registerDeeplinkHandler((link: DeeplinkRoute) => {
          const path = deeplinkToRouterPath(link);
          // Use the navigate ref to avoid stale closure issues
          if (navigateRef.current) {
            navigateRef.current(path);
          }
          // Special case: new item action triggers Quick Capture modal
          if (link.route === 'new') {
            setQuickCaptureOpen(true);
          }
        });
      } catch {
        // Deep-link plugin not available
      }
    };

    setup();

    return () => {
      if (hotkeyRegistered) {
        unregisterAll().catch(() => {});
      }
      cleanupDeeplink?.();
    };
  }, [isLocked, isFirstLaunch]);

  if (isFirstLaunch) {
    return <OnboardingPassphrase />;
  }

  if (isLocked) {
    return <LockScreen />;
  }

  return (
    <ErrorBoundary>
      <NavigateCapture navigateRef={navigateRef} />
      <QuickCaptureModal
        isOpen={quickCaptureOpen}
        onClose={() => setQuickCaptureOpen(false)}
      />
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<ErrorBoundary><Home /></ErrorBoundary>} />
          <Route path="/cloud/:cloudType" element={<ErrorBoundary><Cloud /></ErrorBoundary>} />
          <Route path="/experience/:id" element={<ErrorBoundary><Experience /></ErrorBoundary>} />
          <Route path="/timeline" element={<ErrorBoundary><Timeline /></ErrorBoundary>} />
          <Route path="/graph" element={<ErrorBoundary><Graph /></ErrorBoundary>} />
          <Route path="/settings" element={<ErrorBoundary><Settings /></ErrorBoundary>} />
          <Route path="/import" element={<ErrorBoundary><ImportView /></ErrorBoundary>} />
          <Route path="/review/:jobId" element={<ErrorBoundary><ReviewView /></ErrorBoundary>} />
        </Route>
      </Routes>
    </ErrorBoundary>
  );
}

/**
 * Helper component that captures the navigate function into a ref so
 * the deep-link handler (set up in a useEffect) can call it without
 * going stale.
 */
function NavigateCapture({
  navigateRef,
}: {
  navigateRef: React.MutableRefObject<ReturnType<typeof useNavigate> | null>;
}) {
  const navigate = useNavigate();
  const stableNavigate = useCallback(navigate, []); // eslint-disable-line react-hooks/exhaustive-deps
  navigateRef.current = stableNavigate;
  return null;
}
