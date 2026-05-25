import { AsyncLocalStorage } from "node:async_hooks";

const userContext = new AsyncLocalStorage();

export function runWithUserId(userId, fn) {
  return userContext.run({ userId }, fn);
}

export function getContextUserId() {
  return userContext.getStore()?.userId || null;
}

export function resolveUserId(userId) {
  if (userId && userId !== "dad") return userId;
  return getContextUserId() || userId || "dad";
}
