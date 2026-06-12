export type IdleStateChangeHandler = (state: "active" | "idle" | "paused") => void;

export class IdleDetector {
  private idleTimeout: number = 300_000; // 5 min
  private pauseTimeout: number = 420_000; // 7 min
  private idleTimer: ReturnType<typeof setTimeout> | null = null;
  private pauseTimer: ReturnType<typeof setTimeout> | null = null;
  private lastActivity: number = Date.now();
  private isIdle: boolean = false;
  private isPaused: boolean = false;
  private onStateChange: IdleStateChangeHandler | null = null;
  private events: string[] = ["mousemove", "mousedown", "keydown", "scroll", "touchstart", "wheel"];
  private boundHandler: (() => void) | null = null;

  setOnStateChange(cb: IdleStateChangeHandler) {
    this.onStateChange = cb;
  }

  setIdleTimeout(ms: number) {
    this.idleTimeout = ms;
  }

  setPauseTimeout(ms: number) {
    this.pauseTimeout = ms;
  }

  start() {
    this.boundHandler = this.handleActivity.bind(this);
    for (const evt of this.events) {
      window.addEventListener(evt, this.boundHandler, { passive: true });
    }
    this.resetTimers();
  }

  stop() {
    if (this.boundHandler) {
      for (const evt of this.events) {
        window.removeEventListener(evt, this.boundHandler);
      }
    }
    this.clearTimers();
  }

  private handleActivity() {
    this.lastActivity = Date.now();

    if (this.isPaused) {
      this.isPaused = false;
      this.isIdle = false;
      this.onStateChange?.("active");
    } else if (this.isIdle) {
      this.isIdle = false;
      this.onStateChange?.("active");
    }

    this.resetTimers();
  }

  private resetTimers() {
    this.clearTimers();

    this.idleTimer = setTimeout(() => {
      this.isIdle = true;
      this.onStateChange?.("idle");

      this.pauseTimer = setTimeout(() => {
        this.isPaused = true;
        this.onStateChange?.("paused");
      }, this.pauseTimeout - this.idleTimeout);
    }, this.idleTimeout);
  }

  private clearTimers() {
    if (this.idleTimer) {
      clearTimeout(this.idleTimer);
      this.idleTimer = null;
    }
    if (this.pauseTimer) {
      clearTimeout(this.pauseTimer);
      this.pauseTimer = null;
    }
  }

  getLastActivity(): number {
    return this.lastActivity;
  }

  getState(): "active" | "idle" | "paused" {
    if (this.isPaused) return "paused";
    if (this.isIdle) return "idle";
    return "active";
  }
}

export const idleDetector = new IdleDetector();
