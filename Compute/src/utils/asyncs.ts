export async function mapAsync<I, O>(
  array: I[],
  callback: (value: I, index: number, array: I[]) => Promise<O>,
): Promise<O[]> {
  return await Promise.all(array.map(callback));
}
