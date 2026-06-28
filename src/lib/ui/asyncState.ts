export type AsyncStatus = "idle" | "pending" | "success" | "error";

export type AsyncActionState<T = unknown> = {
  status: AsyncStatus;
  data?: T;
  error?: string;
};

export function idleAsyncState<T = unknown>(): AsyncActionState<T> {
  return { status: "idle" };
}
