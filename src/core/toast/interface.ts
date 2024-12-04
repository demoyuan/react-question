export interface Toast {
  show(message: string): void;
  hide?(): void;
  config?: {
    duration?: number;
    position?: 'top' | 'bottom' | 'center';
    type?: 'success' | 'error' | 'warning' | 'info';
  };
}

// 默认
export class ConsoleToast implements Toast {
  show(message: string): void {
    console.error(message);
  }
}