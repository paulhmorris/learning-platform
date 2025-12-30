import type { Attribute } from "@strapi/strapi";

import {
  formatSeconds,
  getStrapiImgSrcSetAndSizes,
  hexToPartialHSL,
  normalizeSeconds,
  valueIsNotNullishOrZero,
} from "~/lib/utils";

describe("getStrapiImgSrcSetAndSizes", () => {
  it("returns empty strings when formats is undefined", () => {
    expect(getStrapiImgSrcSetAndSizes(undefined)).toEqual({ srcSet: "", sizes: "" });
  });

  it("builds srcSet and sizes from formats object", () => {
    const formats = {
      small: { url: "/small.jpg", width: 320 },
      large: { url: "/large.jpg", width: 1024 },
    } as unknown as Attribute.JsonValue;

    const result = getStrapiImgSrcSetAndSizes(formats);
    expect(result.srcSet).toContain("/small.jpg 320w");
    expect(result.srcSet).toContain("/large.jpg 1024w");
    expect(result.sizes).toContain("(max-width: 320px) 320px");
    expect(result.sizes).toContain("(max-width: 1024px) 1024px");
  });
});

describe("valueIsNotNullishOrZero", () => {
  it("returns false for null or 0", () => {
    expect(valueIsNotNullishOrZero(null)).toBe(false);
    expect(valueIsNotNullishOrZero(0)).toBe(false);
  });
  it("returns true for other values", () => {
    expect(valueIsNotNullishOrZero(1)).toBe(true);
    expect(valueIsNotNullishOrZero("")).toBe(true);
    expect(valueIsNotNullishOrZero(undefined as any)).toBe(false);
  });
});

describe("formatSeconds", () => {
  it("formats seconds as m:ss", () => {
    expect(formatSeconds(75)).toBe("1:15");
    expect(formatSeconds(5)).toBe("0:05");
    expect(formatSeconds(0)).toBe("0:00");
  });
});

describe("normalizeSeconds", () => {
  it("renders minutes under or equal to 1 hour", () => {
    expect(normalizeSeconds(90)).toBe("1 min");
    expect(normalizeSeconds(3600)).toBe("60 min");
  });
  it("renders hours and minutes over 1 hour with pluralization", () => {
    expect(normalizeSeconds(3601)).toBe("1 hr 0 min");
    expect(normalizeSeconds(7200)).toBe("2 hrs 0 min");
    expect(normalizeSeconds(7265)).toBe("2 hrs 1 min");
  });
});

describe("hexToPartialHSL", () => {
  it("returns null for falsy input", () => {
    expect(hexToPartialHSL(undefined)).toBeNull();
  });
  it("handles 3-digit hex", () => {
    expect(hexToPartialHSL("#fff")).toBe("0 0% 100%");
    expect(hexToPartialHSL("#000")).toBe("0 0% 0%");
  });
  it("handles 6-digit hex", () => {
    expect(hexToPartialHSL("#ff0000")).toBe("0 100% 50%");
    expect(hexToPartialHSL("#00ff00")).toBe("120 100% 50%");
    expect(hexToPartialHSL("#0000ff")).toBe("240 100% 50%");
  });
});
