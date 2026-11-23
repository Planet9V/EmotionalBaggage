// @vitest-environment jsdom
// The old sign-in page is linked from the public welcome page: while the default password is in use it says so,
// and where an operator finds the account, but never prints the account's name or password.
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import axe from "axe-core";
import { SignInForm } from "@/app/sign-in/SignInForm";

afterEach(cleanup);

describe("the sign-in page's default-account notice", () => {
  it("says the default is in use and points to the Admin guide, without the name or password", async () => {
    const { container } = render(<SignInForm next="/" showDefault />);
    const notice = container.querySelector("#sign-in-default")!;
    expect(notice.textContent).toMatch(/still uses the default account and its published password/);
    expect(notice.textContent).toMatch(/Admin guide, under .Signing in./);
    expect(notice.textContent).not.toMatch(/\bdemo\b/i);
    expect(container.textContent).not.toMatch(/\bdemo\b/i);
    const r = await axe.run(container, { rules: { "color-contrast": { enabled: false } } });
    expect(r.violations.map((v) => v.id)).toEqual([]);
  });

  it("shows no notice once the password has been changed", () => {
    render(<SignInForm next="/" showDefault={false} />);
    expect(screen.queryByText(/default account/)).toBeNull();
  });
});
