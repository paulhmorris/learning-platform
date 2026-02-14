import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { StrapiImage } from "./strapi-image";

vi.mock("~/lib/utils", async (importOriginal) => {
  const actual = await importOriginal<typeof import("~/lib/utils")>();
  return {
    ...actual,
    getStrapiImgSrcSetAndSizes: vi.fn().mockReturnValue({
      srcSet: "small.jpg 300w, large.jpg 800w",
      sizes: "(max-width: 300px) 300px, (max-width: 800px) 800px",
    }),
  };
});

describe("StrapiImage", () => {
  it("renders nothing when asset is null", () => {
    const { container } = render(<StrapiImage asset={null} alt="test" />);
    expect(container.innerHTML).toBe("");
  });

  it("renders nothing when asset has no url", () => {
    const asset = { data: { attributes: { url: "", formats: null, width: 100, height: 100 } } } as any;
    const { container } = render(<StrapiImage asset={asset} alt="test" />);
    expect(container.innerHTML).toBe("");
  });

  it("renders img without srcSet when formats are null", () => {
    (window as any).ENV = { STRAPI_URL: "https://strapi.example.com" };
    const asset = {
      data: {
        id: 1,
        attributes: { url: "/uploads/image.jpg", formats: null, width: 800, height: 600 },
      },
    } as any;

    render(<StrapiImage asset={asset} alt="Hero image" />);
    const img = screen.getByRole("img", { name: "Hero image" });
    expect(img).toHaveAttribute("src", "https://strapi.example.com/uploads/image.jpg");
    expect(img).not.toHaveAttribute("srcSet");
  });

  it("renders img with srcSet when formats are present", () => {
    (window as any).ENV = { STRAPI_URL: "https://strapi.example.com" };
    const asset = {
      data: {
        id: 1,
        attributes: {
          url: "/uploads/image.jpg",
          formats: { small: { url: "/small.jpg", width: 300 }, large: { url: "/large.jpg", width: 800 } },
          width: 800,
          height: 600,
        },
      },
    } as any;

    render(<StrapiImage asset={asset} alt="Responsive" />);
    const img = screen.getByRole("img", { name: "Responsive" });
    expect(img).toHaveAttribute("srcSet");
    expect(img).toHaveAttribute("sizes");
  });
});
