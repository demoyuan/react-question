import { Toast, ConsoleToast } from '../toast/interface';
// 例如接入Antd UI
// import { message } from 'antd';
// class AntdToast implements Toast {
//   show(msg: string) {
//     message.error(msg);
//   }
// }

export interface ErrorHandler {
  showError: (message: string) => void;
  setToast: (toast: Toast) => void;
}

export class defaultErrorHandler implements ErrorHandler {
  private static instance: defaultErrorHandler;
  private toast: Toast;

  private constructor() {
    this.toast = new ConsoleToast();
    // this.setToast(new AntdToast())
  }

  static getInstance(): defaultErrorHandler {
    if (!defaultErrorHandler.instance) {
      defaultErrorHandler.instance = new defaultErrorHandler();
    }
    return defaultErrorHandler.instance;
  }

  // 设置 Toast UI
  setToast(toast: Toast): void {
    this.toast = toast;
  }

  showError(message: string): void {
    this.toast.show(message);
  }
}
