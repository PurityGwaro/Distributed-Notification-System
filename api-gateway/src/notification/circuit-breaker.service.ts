import { Injectable } from '@nestjs/common';

interface CircuitState {
  failures: number;
  lastFailureTime: number;
  state: 'CLOSED' | 'OPEN' | 'HALF_OPEN';
}

@Injectable()
export class CircuitBreakerService {
  private circuits: Map<String, CircuitState> = new Map();
  private readonly threshold = 5;
  private readonly timeout = 60000; // 1 minute

  async execute<T>(
    operation: () => Promise<T>,
    circuitName: string,
  ): Promise<T> {
    const circuit = this.getCircuit(circuitName);

    if (circuit.state === 'OPEN') {
      if (Date.now() - circuit.lastFailureTime > this.timeout) {
        circuit.state = 'HALF_OPEN';
      } else {
        throw new Error(`Circuit breaker is OPEN for ${circuitName}`);
      }
    }

    try {
      const result = await operation();
      this.onSuccess(circuitName);
      return result;
    } catch (error) {
      this.onFailure(circuitName);
      throw error;
    }
  }

  private getCircuit(name: string): CircuitState {
    if (!this.circuits.has(name)) {
      this.circuits.set(name, {
        failures: 0,
        lastFailureTime: 0,
        state: 'CLOSED',
      });
    }
    return this.circuits.get(name);
  }

  private onSuccess(name: string): void {
    const circuit = this.getCircuit(name);
    circuit.failures = 0;
    circuit.state = 'CLOSED';
  }

  private onFailure(name: string): void {
    const circuit = this.getCircuit(name);
    circuit.failures++;
    circuit.lastFailureTime = Date.now();

    if (circuit.failures >= this.threshold) {
      circuit.state = 'OPEN';
      console.log(`Circuit breaker OPEN for ${name}`);
    }
  }
}