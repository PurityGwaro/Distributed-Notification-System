import { CircuitBreakerService, CircuitState } from './circuit-breaker.service';

describe('CircuitBreakerService', () => {
  let service: CircuitBreakerService;

  beforeEach(() => {
    service = new CircuitBreakerService({
      failureThreshold: 3,
      resetTimeout: 1000,
      successThreshold: 2,
    });
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should start in CLOSED state', () => {
    expect(service.getState()).toBe(CircuitState.CLOSED);
  });

  it('should execute successful operations', async () => {
    const mockFn = jest.fn().mockResolvedValue('success');
    const result = await service.execute(mockFn);

    expect(result).toBe('success');
    expect(mockFn).toHaveBeenCalled();
    expect(service.getState()).toBe(CircuitState.CLOSED);
  });

  it('should open circuit after threshold failures', async () => {
    const mockFn = jest.fn().mockRejectedValue(new Error('failed'));

    // Trigger failures to open circuit
    for (let i = 0; i < 3; i++) {
      try {
        await service.execute(mockFn);
      } catch {
        // Expected to fail
      }
    }

    expect(service.getState()).toBe(CircuitState.OPEN);
  });

  it('should reject requests when circuit is OPEN', async () => {
    const mockFn = jest.fn().mockRejectedValue(new Error('failed'));

    // Open the circuit
    for (let i = 0; i < 3; i++) {
      try {
        await service.execute(mockFn);
      } catch {
        // Expected to fail
      }
    }

    // Circuit should be open now
    expect(service.getState()).toBe(CircuitState.OPEN);

    // Next request should be blocked
    await expect(service.execute(mockFn)).rejects.toThrow(
      'Circuit breaker is OPEN',
    );
  });

  it('should transition to HALF_OPEN after timeout', async () => {
    const mockFn = jest.fn().mockRejectedValue(new Error('failed'));

    // Open the circuit
    for (let i = 0; i < 3; i++) {
      try {
        await service.execute(mockFn);
      } catch {
        // Expected to fail
      }
    }

    expect(service.getState()).toBe(CircuitState.OPEN);

    // Wait for reset timeout
    await new Promise((resolve) => setTimeout(resolve, 1100));

    // Mock successful response
    mockFn.mockResolvedValueOnce('success');

    // Should transition to HALF_OPEN and allow request
    await service.execute(mockFn);
    expect(service.getState()).toBe(CircuitState.HALF_OPEN);
  });

  it('should close circuit after successful requests in HALF_OPEN', async () => {
    const mockFn = jest.fn().mockRejectedValue(new Error('failed'));

    // Open the circuit
    for (let i = 0; i < 3; i++) {
      try {
        await service.execute(mockFn);
      } catch {
        // Expected to fail
      }
    }

    // Wait for reset timeout
    await new Promise((resolve) => setTimeout(resolve, 1100));

    // Mock successful responses
    mockFn.mockResolvedValue('success');

    // Execute successful requests to close circuit
    await service.execute(mockFn);
    await service.execute(mockFn);

    expect(service.getState()).toBe(CircuitState.CLOSED);
  });

  it('should return correct statistics', () => {
    const stats = service.getStats();

    expect(stats).toHaveProperty('state');
    expect(stats).toHaveProperty('failureCount');
    expect(stats).toHaveProperty('successCount');
    expect(stats).toHaveProperty('nextAttemptTime');
  });

  it('should reset circuit breaker manually', async () => {
    const mockFn = jest.fn().mockRejectedValue(new Error('failed'));

    // Open the circuit
    for (let i = 0; i < 3; i++) {
      try {
        await service.execute(mockFn);
      } catch {
        // Expected to fail
      }
    }

    expect(service.getState()).toBe(CircuitState.OPEN);

    // Manually reset
    service.reset();

    expect(service.getState()).toBe(CircuitState.CLOSED);
    const stats = service.getStats();
    expect(stats.failureCount).toBe(0);
    expect(stats.successCount).toBe(0);
  });
});
