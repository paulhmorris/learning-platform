import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("react-router", () => ({
  useFetcher: vi.fn(),
}));

import { useFetcher } from "react-router";

import { useProgress } from "./useProgress";

const mockUseFetcher = vi.mocked(useFetcher);
const load = vi.fn();

function mockFetcher(data: unknown) {
  mockUseFetcher.mockReturnValue({ state: "idle", data, load } as unknown as ReturnType<typeof useFetcher>);
}

describe("useProgress", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("exposes progress from a successful load", () => {
    const lessonProgress = [{ lessonId: 1, isCompleted: true }];
    mockFetcher({ ok: true, lessonProgress, quizProgress: [] });

    const { result } = renderHook(() => useProgress());

    expect(result.current.lessonProgress).toEqual(lessonProgress);
    expect(result.current.isError).toBe(false);
  });

  it("flags isError when the loader reports a failure", () => {
    mockFetcher({ ok: false, lessonProgress: [], quizProgress: [] });

    const { result } = renderHook(() => useProgress());

    expect(result.current.isError).toBe(true);
  });

  it("does not report an error for a genuinely empty but successful load", () => {
    // The regression this guards: "no progress yet" must stay distinguishable from
    // "couldn't load progress", since both surface as empty arrays.
    mockFetcher({ ok: true, lessonProgress: [], quizProgress: [] });

    const { result } = renderHook(() => useProgress());

    expect(result.current.lessonProgress).toEqual([]);
    expect(result.current.isError).toBe(false);
  });

  it("is not in an error state before the first load resolves", () => {
    mockFetcher(undefined);

    const { result } = renderHook(() => useProgress());

    expect(result.current.isError).toBe(false);
    expect(result.current.isLoading).toBe(true);
  });

  it("refetch re-requests the progress endpoint", () => {
    mockFetcher({ ok: false, lessonProgress: [], quizProgress: [] });

    const { result } = renderHook(() => useProgress());
    result.current.refetch();

    expect(load).toHaveBeenCalledWith("/api/progress");
  });
});
