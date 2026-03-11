import "@testing-library/jest-dom";

if (!globalThis.crypto) {
  Object.defineProperty(globalThis, "crypto", {
    value: {
      randomUUID: () => "test-uuid",
    },
    configurable: true,
  });
} else if (!globalThis.crypto.randomUUID) {
  Object.defineProperty(globalThis.crypto, "randomUUID", {
    value: () => "test-uuid",
    configurable: true,
  });
}
