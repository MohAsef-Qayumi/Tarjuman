import { describe, expect, it } from "vitest"
import { RateLimiter } from "./rate-limit"

describe("RateLimiter", () => {
  it("allows up to the limit per window, then reports when to retry", () => {
    let t = 0
    const limiter = new RateLimiter(2, 60_000, () => t)
    expect(limiter.check("a")).toBe(0)
    expect(limiter.check("a")).toBe(0)
    expect(limiter.check("a")).toBe(60)
    expect(limiter.check("b")).toBe(0)
    t = 60_000
    expect(limiter.check("a")).toBe(0)
  })
})
