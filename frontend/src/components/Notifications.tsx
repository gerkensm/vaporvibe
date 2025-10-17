import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

export type NotificationTone = "info" | "error" | "success";

export interface NotificationDescriptor {
  id: number;
  tone: NotificationTone;
  message: string;
  dismissible?: boolean;
  durationMs?: number | null;
}

interface NotificationContextValue {
  notify: (
    tone: NotificationTone,
    message: string,
    options?: Omit<NotificationDescriptor, "id" | "tone" | "message">
  ) => void;
  dismiss: (id: number) => void;
}

const NotificationContext = createContext<NotificationContextValue | null>(null);

const DEFAULT_DURATION_MS = 6000;

interface NotificationStackProps {
  items: NotificationDescriptor[];
  onDismiss: (id: number) => void;
}

function NotificationStack({ items, onDismiss }: NotificationStackProps) {
  return (
    <div className="notifications" role="region" aria-live="polite">
      {items.map((item) => (
        <div
          key={item.id}
          className={`notification notification--${item.tone}`}
          role="status"
        >
          <span className="notification__message">{item.message}</span>
          {item.dismissible !== false ? (
            <button
              type="button"
              className="notification__dismiss"
              onClick={() => onDismiss(item.id)}
              aria-label="Dismiss"
            >
              ×
            </button>
          ) : null}
        </div>
      ))}
    </div>
  );
}

export function NotificationsProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<NotificationDescriptor[]>([]);
  const timers = useRef<Map<number, number>>(new Map());

  const clearTimer = useCallback((id: number) => {
    const map = timers.current;
    const timeoutId = map.get(id);
    if (timeoutId != null) {
      window.clearTimeout(timeoutId);
      map.delete(id);
    }
  }, []);

  const dismiss = useCallback((id: number) => {
    clearTimer(id);
    setItems((previous) => previous.filter((item) => item.id !== id));
  }, [clearTimer]);

  const notify = useCallback<NotificationContextValue["notify"]>(
    (tone, message, options) => {
      setItems((previous) => {
        const id = Date.now() + Math.floor(Math.random() * 1000);
        const descriptor: NotificationDescriptor = {
          id,
          tone,
          message,
          dismissible: options?.dismissible ?? true,
          durationMs: options?.durationMs ?? DEFAULT_DURATION_MS,
        };
        return [...previous, descriptor];
      });
    },
    []
  );

  useEffect(() => {
    items.forEach((item) => {
      if (item.durationMs === null) {
        clearTimer(item.id);
        return;
      }
      if (timers.current.has(item.id)) {
        return;
      }
      const timeoutId = window.setTimeout(() => {
        dismiss(item.id);
      }, item.durationMs ?? DEFAULT_DURATION_MS);
      timers.current.set(item.id, timeoutId);
    });
    return () => {
      timers.current.forEach((timeoutId) => window.clearTimeout(timeoutId));
      timers.current.clear();
    };
  }, [items, dismiss, clearTimer]);

  const value = useMemo<NotificationContextValue>(() => ({ notify, dismiss }), [
    notify,
    dismiss,
  ]);

  return (
    <NotificationContext.Provider value={value}>
      {children}
      <NotificationStack items={items} onDismiss={dismiss} />
    </NotificationContext.Provider>
  );
}

export function useNotifications(): NotificationContextValue {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error("useNotifications must be used within NotificationsProvider");
  }
  return context;
}
