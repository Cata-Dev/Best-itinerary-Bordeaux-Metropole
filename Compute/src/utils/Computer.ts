import { JobName, Processor } from "../jobs";

class Computer<J extends JobName, D = void, PC = void> {
  private preComputedData: PC;

  constructor(
    private readonly processor: (
      data: D,
      preComputedData: PC,
      ...args: Parameters<Processor<J>>
    ) => ReturnType<Processor<J>>,
    private data: D,
    private readonly preCompute: (data: D) => PC,
  ) {
    this.preComputedData = this.preCompute(this.data);
  }

  /**
   * Will also pre-compute data
   */
  public updateData(data: Partial<D>) {
    this.data = { ...this.data, ...data };
    if (this.preCompute) this.preComputedData = this.preCompute(this.data);
  }

  public compute(...args: Parameters<Processor<J>>) {
    return this.processor(this.data, this.preComputedData, ...args);
  }
}

export { Computer };
