// @vitest-environment jsdom
// Robustness review S6: model markdown could make the browser fetch a remote image (![t](http://host/track.png)).
// The answer is rendered with the real Streamdown component, as the chat page renders it.
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { Answer } from "@/components/chat/Answer";
import { isSameOriginImage } from "@/components/chat/safeImage";

afterEach(cleanup);

describe("images in a model answer", () => {
  it("the reviewer's repro: a remote image is not drawn, only its alt text as a link", async () => {
    render(<Answer text={"Look: ![tracker pixel](http://evil.example/track.png) and ![ours](/api/files/7) and ![rel](//evil.example/x.png)"} streaming={false} />);
    await screen.findByText(/Look:/);
    const imgs = [...document.querySelectorAll("img")].map((i) => i.getAttribute("src"));
    expect(imgs.some((s) => s && /evil\.example/.test(s))).toBe(false);
    expect(imgs.some((s) => s && s.endsWith("/api/files/7"))).toBe(true);
    const link = screen.getByRole("link", { name: "[image: tracker pixel]" });
    expect(link.getAttribute("href")).toBe("http://evil.example/track.png");
    // Streamdown's own hardening turns "//evil.example/x.png" into the same-origin "/x.png": nothing leaves either way
    expect(document.body.innerHTML).not.toMatch(/src="[^"]*evil\.example/);
  });

  it("decides same origin strictly", () => {
    const o = "http://localhost:3000";
    expect(isSameOriginImage("/api/files/1", o)).toBe(true);
    expect(isSameOriginImage("http://localhost:3000/a.png", o)).toBe(true);
    expect(isSameOriginImage("//localhost:3000/a.png", o)).toBe(false);
    expect(isSameOriginImage("http://localhost:3001/a.png", o)).toBe(false);
    expect(isSameOriginImage("data:image/png;base64,AAAA", o)).toBe(false);
    expect(isSameOriginImage("javascript:alert(1)", o)).toBe(false);
    expect(isSameOriginImage(undefined, o)).toBe(false);
  });
});
