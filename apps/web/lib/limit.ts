/**
 * Runs at most `concurrency` tasks at once; the others wait their turn in order.
 * Returns a function that queues a task and resolves with its result.
 */
export function createLimiter(concurrency: number) {
  let active = 0;
  const queue: (() => void)[] = [];

  const next = () => {
    if (active >= concurrency) return;
    const start = queue.shift();
    if (!start) return;
    active += 1;
    start();
  };

  return <T>(task: () => Promise<T>) =>
    new Promise<T>((resolve, reject) => {
      queue.push(() => {
        task()
          .then(resolve, reject)
          .finally(() => {
            active -= 1;
            next();
          });
      });
      next();
    });
}
