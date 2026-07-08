/** Swallow Ably promise rejections (e.g. "Connection closed" on teardown). */
export function ablyIgnore(promise: PromiseLike<unknown> | void | null | undefined): void {
  Promise.resolve(promise).catch(() => {});
}
