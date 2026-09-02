import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import App, { getFreshness } from "./App";

function jsonResponse(body: unknown): Response {
  return {
    ok: true,
    json: async () => body,
  } as Response;
}

describe("App", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("shows the empty listing state", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ listings: [] }))
      .mockResolvedValueOnce(jsonResponse({ run: null }))
      .mockResolvedValueOnce(jsonResponse({ sources: [] }));
    vi.stubGlobal("fetch", fetchMock);

    render(<App />);

    expect(await screen.findByText("No roles found yet")).toBeVisible();
    expect(screen.getByRole("button", { name: "Refresh" })).toBeEnabled();
  });

  it.each([
    [13, "Latest", "freshness-latest"],
    [14, "2 weeks+", "freshness-two-weeks"],
    [28, "1 month+", "freshness-one-month"],
    [60, "2 months+", "freshness-two-months"],
  ])("classifies a listing at %i days as %s", (days, label, className) => {
    const now = new Date("2026-09-03T00:00:00.000Z");
    const lastSeenAt = new Date(
      now.getTime() - Number(days) * 24 * 60 * 60 * 1000,
    ).toISOString();

    expect(getFreshness(lastSeenAt, now)).toEqual({ label, className });
  });

  it("shows posted date and freshness for a listing", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse({
          listings: [
            {
              id: "listing-1",
              sourceId: "xero",
              companyName: "Xero",
              title: "Frontend Engineer",
              location: "Wellington",
              summary: "Build useful software.",
              postedAt: "2026-09-01T14:30:00.000Z",
              sourceUrl: "https://example.com/jobs/1",
              firstSeenAt: "2026-09-01T00:00:00.000Z",
              lastSeenAt: "2026-09-02T00:00:00.000Z",
              status: "active",
              saved: false,
              employmentType: null,
            },
          ],
        }),
      )
      .mockResolvedValueOnce(jsonResponse({ run: null }))
      .mockResolvedValueOnce(
        jsonResponse({
          sources: [
            {
              id: "xero",
              name: "Xero",
              careersUrl: "https://example.com",
              endpointUrl: null,
              sourceType: "test",
              enabled: true,
              policyStatus: "approved",
            },
          ],
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse({
          listing: {
            id: "listing-1",
            sourceId: "xero",
            companyName: "Xero",
            title: "Frontend Engineer",
            location: "Wellington",
            summary: "Build useful software.",
            postedAt: "2026-09-01T14:30:00.000Z",
            sourceUrl: "https://example.com/jobs/1",
            firstSeenAt: "2026-09-01T00:00:00.000Z",
            lastSeenAt: "2026-09-02T00:00:00.000Z",
            status: "active",
            saved: true,
            employmentType: null,
          },
        }),
      );
    vi.stubGlobal("fetch", fetchMock);

    render(<App />);

    expect(await screen.findByText("Frontend Engineer")).toBeVisible();
    expect(screen.getByText(/Sep 1, 2026/)).toHaveTextContent(/\d{1,2}:\d{2}/);
    expect(
      screen.getByText("Latest", { selector: "span.freshness" }),
    ).toBeVisible();

    fireEvent.click(
      screen.getByRole("button", { name: "Save Frontend Engineer" }),
    );
    expect(
      await screen.findByRole("button", { name: "Unsave Frontend Engineer" }),
    ).toBeVisible();

    fireEvent.click(screen.getByText("Frontend Engineer"));
    expect(screen.getByText("Build useful software.")).toBeVisible();
    const collapseButton = screen.getByRole("button", {
      name: "Collapse details",
    });
    expect(collapseButton).toBeVisible();
    expect(collapseButton).toHaveTextContent("");

    fireEvent.click(collapseButton);
    expect(
      screen.queryByText("Build useful software."),
    ).not.toBeInTheDocument();
  });
});
