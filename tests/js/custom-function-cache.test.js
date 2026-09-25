import { describe, expect, it, vi } from "vitest";

import { loadCustomFunctionsCode } from "./harness.js";

function invoke(
  api,
  {
    ticker = "IBM",
    token = 1,
    address = "Sheet1!A1",
    callerScoped = false,
  } = {},
) {
  return api.base("history", false, true, callerScoped, [[ticker]], [[token]], {
    address,
  });
}

describe("custom function client cache", () => {
  it("returns repeated calls locally and refreshes when any argument changes", async () => {
    const api = loadCustomFunctionsCode();
    const post = vi.fn(async (_url, body) => ({
      data: { result: [[`${body.args[0][0][0]}:${body.args[1][0][0]}`]] },
    }));
    api.globalThisStub.xwRequest.post = post;

    expect(await invoke(api)).toEqual([["IBM:1"]]);
    expect(await invoke(api)).toEqual([["IBM:1"]]);
    expect(post).toHaveBeenCalledTimes(1);

    expect(await invoke(api, { ticker: "MSFT" })).toEqual([["MSFT:1"]]);
    expect(await invoke(api, { token: 2 })).toEqual([["IBM:2"]]);
    expect(post).toHaveBeenCalledTimes(3);
  });

  it("keeps callers and authentication contexts separate", async () => {
    let token = "alice";
    const api = loadCustomFunctionsCode({
      getAuth: async () => ({ token, provider: "test" }),
    });
    const post = vi.fn(async () => ({ data: { result: [["ok"]] } }));
    api.globalThisStub.xwRequest.post = post;

    await invoke(api, { callerScoped: true });
    await invoke(api, { address: "Sheet1!B1", callerScoped: true });
    token = "bob";
    await invoke(api, { callerScoped: true });

    expect(post).toHaveBeenCalledTimes(3);
  });

  it("shares ordinary results across calling cells", async () => {
    const api = loadCustomFunctionsCode();
    const post = vi.fn(async () => ({ data: { result: [["ok"]] } }));
    api.globalThisStub.xwRequest.post = post;

    await invoke(api);
    await invoke(api, { address: "Sheet1!B1" });

    expect(post).toHaveBeenCalledTimes(1);
  });

  it("shares an in-flight request for the same key", async () => {
    const api = loadCustomFunctionsCode();
    let finish;
    const post = vi.fn(
      () =>
        new Promise((resolve) => {
          finish = () => resolve({ data: { result: [["done"]] } });
        }),
    );
    api.globalThisStub.xwRequest.post = post;

    const first = invoke(api);
    const second = invoke(api);
    await vi.waitFor(() => expect(post).toHaveBeenCalledTimes(1));
    finish();
    expect(await Promise.all([first, second])).toEqual([
      [["done"]],
      [["done"]],
    ]);
  });

  it("does not cache side effects or rich results", async () => {
    const api = loadCustomFunctionsCode();
    const post = vi
      .fn()
      .mockResolvedValueOnce({
        data: { result: [["ok"]], script: { script_name: "follow_up" } },
      })
      .mockResolvedValueOnce({
        data: { result: [[{ type: "Entity", text: "handle" }]] },
      })
      .mockResolvedValue({ data: { result: [["plain"]] } });
    api.globalThisStub.xwRequest.post = post;

    await invoke(api);
    await invoke(api);
    expect(api.getCacheSize()).toBe(0);
    await invoke(api);
    await invoke(api);
    expect(post).toHaveBeenCalledTimes(3);
  });

  it("does not retain oversized results", async () => {
    const api = loadCustomFunctionsCode();
    const post = vi.fn(async () => ({
      data: { result: [["x".repeat(600_000)]] },
    }));
    api.globalThisStub.xwRequest.post = post;

    await invoke(api);
    await invoke(api);
    expect(post).toHaveBeenCalledTimes(2);
    expect(api.getCacheSize()).toBe(0);
  });

  it("retries failed calls instead of caching an error", async () => {
    const api = loadCustomFunctionsCode();
    const post = vi.fn(async () => {
      throw { response: { status: 400, data: { detail: "bad input" } } };
    });
    api.globalThisStub.xwRequest.post = post;
    const errorLog = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      await expect(invoke(api)).rejects.toBeInstanceOf(Error);
      await expect(invoke(api)).rejects.toBeInstanceOf(Error);
      expect(post).toHaveBeenCalledTimes(2);
      expect(api.getCacheSize()).toBe(0);
    } finally {
      errorLog.mockRestore();
    }
  });

  it("evicts the oldest entry when the cache is full", async () => {
    const api = loadCustomFunctionsCode();
    const post = vi.fn(async () => ({ data: { result: [["ok"]] } }));
    api.globalThisStub.xwRequest.post = post;

    for (let token = 0; token < 129; token++) {
      await invoke(api, { token });
    }
    expect(api.getCacheSize()).toBe(128);
    await invoke(api, { token: 0 });
    expect(post).toHaveBeenCalledTimes(130);
  });
});
