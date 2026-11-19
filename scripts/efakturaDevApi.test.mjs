import { describe, it, expect, vi } from "vitest";
import { Readable } from "node:stream";
import { createDevMiddleware, efakturaDevApi } from "./efakturaDevApi.mjs";

const request = (body, headers = { authorization: "Bearer tok" }) => Object.assign(Readable.from(body === undefined ? [] : [body]), { method: "POST", headers });

const response = () => ({
  statusCode: 0,
  headers: {},
  body: null,
  setHeader(name, value) {
    this.headers[name.toLowerCase()] = value;
  },
  end(data) {
    this.body = data;
  },
});

describe("efakturaDevApi", () => {
  it("is a dev-server-only Vite plugin", () => {
    const plugin = efakturaDevApi();
    expect(plugin.name).toBe("efaktura-dev-api");
    expect(plugin.apply).toBe("serve");
    expect(typeof plugin.configureServer).toBe("function");
  });

  it("hands the JSON body and token to the handler and writes its JSON", async () => {
    const handle = vi.fn(async () => ({ status: 409, json: { ok: false, error: "not-connected" } }));
    const res = response();
    await createDevMiddleware({ handle })(request(JSON.stringify({ action: "list" })), res);
    expect(handle).toHaveBeenCalledWith({ method: "POST", authorization: "Bearer tok", body: { action: "list" } });
    expect(res.statusCode).toBe(409);
    expect(res.headers["content-type"]).toBe("application/json");
    expect(JSON.parse(res.body)).toEqual({ ok: false, error: "not-connected" });
  });

  it("writes a PDF as a PDF", async () => {
    const res = response();
    await createDevMiddleware({ handle: async () => ({ status: 200, pdf: new Uint8Array([37, 80, 68, 70]) }) })(request("{}"), res);
    expect(res.statusCode).toBe(200);
    expect(res.headers["content-type"]).toBe("application/pdf");
    expect(Buffer.from(res.body).toString()).toBe("%PDF");
  });

  it("passes an empty body for anything that isn't JSON", async () => {
    const handle = vi.fn(async () => ({ status: 400, json: { ok: false, error: "bad-action" } }));
    await createDevMiddleware({ handle })(request("not json"), response());
    expect(handle.mock.calls[0][0].body).toEqual({});
  });
});
