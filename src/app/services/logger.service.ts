import { Injectable, isDevMode } from '@angular/core';

/**
 * Centralized logging service with debug mode support.
 * Logs are only output in development mode and when DEBUG is enabled.
 */
@Injectable({
  providedIn: 'root'
})
export class LoggerService {
  /** Enable verbose debug logging (set to false for quiet console) */
  private readonly DEBUG = false;
  
  /** Always show errors regardless of debug mode */
  private readonly SHOW_ERRORS = true;

  /** Log debug message (only in dev mode with DEBUG=true) */
  debug(message: string, ...args: any[]): void {
    if (this.DEBUG && isDevMode()) {
      console.log(message, ...args);
    }
  }

  /** Log info message (only in dev mode with DEBUG=true) */
  info(message: string, ...args: any[]): void {
    if (this.DEBUG && isDevMode()) {
      console.info(message, ...args);
    }
  }

  /** Log warning (only in dev mode with DEBUG=true) */
  warn(message: string, ...args: any[]): void {
    if (this.DEBUG && isDevMode()) {
      console.warn(message, ...args);
    }
  }

  /** Log error (always shown when SHOW_ERRORS=true) */
  error(message: string, ...args: any[]): void {
    if (this.SHOW_ERRORS) {
      console.error(message, ...args);
    }
  }
}
