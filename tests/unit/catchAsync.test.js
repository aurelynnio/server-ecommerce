/**
 * Unit Tests: CatchAsync Utility
 * Tests async error wrapping for Express handlers
 */
import { describe, it, expect, vi } from "vitest";

const catchAsync = require("../../src/configs/catchAsync");

describe("catchAsync", () => {
  it("should call the wrapped function with req, res, next", async () => {
    const fn = vi.fn().mockResolvedValue(undefined);
    const wrapped = catchAsync(fn);
    const req = {};
    const res = {};
    const next = vi.fn();

    await wrapped(req, res, next);
    expect(fn).toHaveBeenCalledWith(req, res, next);
  });

  it("should call next with error when async function rejects", async () => {
    const error = new Error("Async failure");
    const fn = vi.fn().mockRejectedValue(error);
    const wrapped = catchAsync(fn);
    const req = {};
    const res = {};
    const next = vi.fn();

    await wrapped(req, res, next);
    expect(next).toHaveBeenCalledWith(error);
  });

  it("should propagate synchronous throws (not caught by Promise.resolve)", () => {
    // catchAsync uses Promise.resolve(fn(...)).catch(next)
    // If fn throws synchronously, the throw happens before Promise.resolve()
    // wraps it, so it propagates as an unhandled exception.
    const fn = vi.fn().mockImplementation(() => {
      throw new Error("Sync failure");
    });
    const wrapped = catchAsync(fn);

    expect(() => wrapped({}, {}, vi.fn())).toThrow("Sync failure");
  });

  it("should not call next when function succeeds", async () => {
    const fn = vi.fn().mockResolvedValue("result");
    const wrapped = catchAsync(fn);
    const req = {};
    const res = {};
    const next = vi.fn();

    await wrapped(req, res, next);
    expect(next).not.toHaveBeenCalled();
  });

  it("should return a function", () => {
    const fn = async () => {};
    const wrapped = catchAsync(fn);
    expect(typeof wrapped).toBe("function");
  });
});
