export {};

declare global {
  interface Window {
    Telegram?: {
      WebApp?: {
        initData?: string;
        initDataUnsafe?: {
          user?: { first_name?: string; language_code?: string };
        };
        ready?: () => void;
        expand?: () => void;
        setHeaderColor?: (color: string) => void;
        setBackgroundColor?: (color: string) => void;
        openTelegramLink?: (url: string) => void;
        themeParams?: Record<string, string | undefined>;
        contentSafeAreaInset?: { top?: number; bottom?: number; left?: number; right?: number };
        safeAreaInset?: { top?: number; bottom?: number; left?: number; right?: number };
        BackButton?: {
          show?: () => void;
          hide?: () => void;
          onClick?: (handler: () => void) => void;
          offClick?: (handler: () => void) => void;
        };
        MainButton?: {
          setText?: (text: string) => void;
          color?: (color: string) => void;
          show?: () => void;
          hide?: () => void;
          enable?: () => void;
          onClick?: (handler: () => void) => void;
          offClick?: (handler: () => void) => void;
        };
        HapticFeedback?: {
          impactOccurred?: (style: 'light' | 'medium' | 'heavy' | 'rigid' | 'soft') => void;
          notificationOccurred?: (type: 'error' | 'success' | 'warning') => void;
        };
        onEvent?: (event: string, handler: () => void) => void;
        offEvent?: (event: string, handler: () => void) => void;
      };
    };
  }
}
