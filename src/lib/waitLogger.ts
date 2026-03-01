export type WaitLogParams = {
  file: string;
  target: string;
  description: string;
};

export async function withWaitLogger<T>(params: WaitLogParams, action: () => Promise<T>): Promise<T> {
  const { file, target, description } = params;
  console.log(`${file} is waiting for ${target} to respond with ${description}`);
  let seconds = 0;
  const intervalId = window.setInterval(() => {
    seconds += 1;
    console.log(`[${file}] Waited for ${seconds} second${seconds === 1 ? '' : 's'}...`);
  }, 1000);

  try {
    return await action();
  } finally {
    window.clearInterval(intervalId);
  }
}
