import { Injectable, Logger } from '@nestjs/common';

export enum CircuitState {
  CLOSED = 'CLOSED',
  OPEN = 'OPEN',
  HALF_OPEN = 'HALF_OPEN',
}

export interface CircuitBreakerOptions {
  failureThreshold?: number; // Number of consecutive failures before opening circuit
  resetTimeout?: number; // Time in ms before attempting half-open state
  successThreshold?: number; // Number of successes in half-open before closing
}

@Injectable()
export class CircuitBreakerService {
  private readonly logger = new Logger(CircuitBreakerService.name);
  private state: CircuitState = CircuitState.CLOSED;
  private failureCount = 0;
  private successCount = 0;
  private nextAttemptTime: number = Date.now();

  private readonly failureThreshold: number;
  private readonly resetTimeout: number;
  private readonly successThreshold: number;

  constructor(options: CircuitBreakerOptions = {}) {
    this.failureThreshold = options.failureThreshold || 5;
    this.resetTimeout = options.resetTimeout || 30000; // 30 seconds
    this.successThreshold = options.successThreshold || 2;
  }

  /**
   * Execute a function with circuit breaker protection
   */
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (this.state === CircuitState.OPEN) {
      if (Date.now() < this.nextAttemptTime) {
        const error = new Error(
          'Circuit breaker is OPEN. Service temporarily unavailable.',
        );
        this.logger.warn(
          `Circuit breaker blocking request. State: ${this.state}`,
        );
        throw error;
      }
      // Transition to half-open to test if service recovered
      this.toHalfOpen();
    }

    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  /**
   * Handle successful execution
   */
  private onSuccess(): void {
    this.failureCount = 0;

    if (this.state === CircuitState.HALF_OPEN) {
      this.successCount++;
      if (this.successCount >= this.successThreshold) {
        this.toClose();
      }
    }
  }

  /**
   * Handle failed execution
   */
  private onFailure(): void {
    this.failureCount++;
    this.successCount = 0;

    if (
      this.state === CircuitState.HALF_OPEN ||
      this.failureCount >= this.failureThreshold
    ) {
      this.toOpen();
    }
  }

  /**
   * Transition to OPEN state
   */
  private toOpen(): void {
    this.state = CircuitState.OPEN;
    this.nextAttemptTime = Date.now() + this.resetTimeout;
    this.logger.error(
      `Circuit breaker opened. Next attempt at ${new Date(this.nextAttemptTime).toISOString()}`,
    );
  }

  /**
   * Transition to HALF_OPEN state
   */
  private toHalfOpen(): void {
    this.state = CircuitState.HALF_OPEN;
    this.successCount = 0;
    this.failureCount = 0;
    this.logger.log('Circuit breaker transitioning to HALF_OPEN state');
  }

  /**
   * Transition to CLOSED state
   */
  private toClose(): void {
    this.state = CircuitState.CLOSED;
    this.successCount = 0;
    this.failureCount = 0;
    this.logger.log('Circuit breaker closed. Service restored.');
  }

  /**
   * Get current circuit state
   */
  getState(): CircuitState {
    return this.state;
  }

  /**
   * Get circuit breaker statistics
   */
  getStats() {
    return {
      state: this.state,
      failureCount: this.failureCount,
      successCount: this.successCount,
      nextAttemptTime:
        this.state === CircuitState.OPEN
          ? new Date(this.nextAttemptTime).toISOString()
          : null,
    };
  }

  /**
   * Manually reset the circuit breaker
   */
  reset(): void {
    this.toClose();
    this.logger.log('Circuit breaker manually reset');
  }
}
