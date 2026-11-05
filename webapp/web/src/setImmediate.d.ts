// Tests run under Node, which provides setImmediate; the app tsconfig only loads DOM types.
declare function setImmediate(callback: (...args: unknown[]) => void): unknown
