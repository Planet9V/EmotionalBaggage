// @vitest-environment jsdom
// The shared UI kit (src/components/ui): one field wrapper, one select, one modal, one set of states.
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { Field, describe as describeControl } from "@/components/ui/field";
import { NativeSelect } from "@/components/ui/native-select";
import { Modal } from "@/components/ui/modal";
import { ConfirmButton } from "@/components/ui/confirm-button";
import { Panel } from "@/components/ui/panel";
import { EmptyState, ErrorLine, LoadError, LoadingBlocks, NotSetUp, SaveError } from "@/components/ui/states";
import { downloadFile } from "@/lib/download";
import { fileSlug, fmtBytes, fmtMinutes, plural, slugify } from "@/lib/format";

afterEach(cleanup);

describe("Field", () => {
  it("labels a control it wraps", () => {
    render(<Field label="Name"><input /></Field>);
    expect(screen.getByLabelText("Name")).toBeTruthy();
  });
  it("gives a render-prop control a generated id", () => {
    render(<Field label="Size">{(id) => <input id={id} />}</Field>);
    expect(screen.getByLabelText("Size")).toBeTruthy();
  });
  it("links hint and error to a control through describe()", () => {
    render(
      <Field id="x" label="Address" hint="Where it is" error="Not reachable" required>
        <input id="x" {...describeControl("x", { hint: true, error: "Not reachable" })} />
      </Field>,
    );
    const input = screen.getByLabelText("Address (required)");
    expect(input.getAttribute("aria-invalid")).toBe("true");
    expect(input.getAttribute("aria-describedby")).toBe("x-hint x-error");
    expect(screen.getByRole("alert").textContent).toBe("Not reachable");
  });
});

describe("NativeSelect", () => {
  it("is a real select with options", () => {
    const on = vi.fn();
    render(
      <NativeSelect aria-label="Status" value="a" onChange={(e) => on(e.target.value)}>
        <option value="a">A</option>
        <option value="b">B</option>
      </NativeSelect>,
    );
    fireEvent.change(screen.getByRole("combobox", { name: "Status" }), { target: { value: "b" } });
    expect(on).toHaveBeenCalledWith("b");
  });
});

describe("Modal and ConfirmButton", () => {
  it("shows its title and closes through onOpenChange", () => {
    const close = vi.fn();
    render(<Modal open onOpenChange={close} title="Edit part" description="Change it"><p>Body</p></Modal>);
    expect(screen.getByRole("dialog", { name: "Edit part" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(close).toHaveBeenCalledWith(false);
  });
  it("asks before it acts", () => {
    const go = vi.fn();
    render(<ConfirmButton label="Delete" title="Delete it?" body="This cannot be undone." confirmLabel="Yes, delete" onConfirm={go} />);
    fireEvent.click(screen.getByRole("button", { name: "Delete" }));
    expect(go).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Yes, delete" }));
    expect(go).toHaveBeenCalledTimes(1);
  });
});

describe("states", () => {
  it("shows an empty state with its action", () => {
    render(<EmptyState title="No parts yet" action={<button>Add a part</button>}>Parts appear here.</EmptyState>);
    expect(screen.getByText("No parts yet")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Add a part" })).toBeTruthy();
  });
  it("announces errors and offers a retry on a failed load", () => {
    const retry = vi.fn();
    render(<LoadError what="The parts" message="Network down" onRetry={retry} />);
    expect(screen.getByRole("alert").textContent).toContain("The parts could not be loaded. Network down");
    fireEvent.click(screen.getByRole("button", { name: /try again/i }));
    expect(retry).toHaveBeenCalled();
  });
  it("renders the error line, save error, not-set-up and loading shapes", () => {
    render(
      <>
        <ErrorLine>Refused</ErrorLine>
        <SaveError message="Name is taken" />
        <NotSetUp href="/admin?tab=models" label="Open Admin">No model chosen.</NotSetUp>
        <LoadingBlocks label="Loading parts" />
      </>,
    );
    expect(screen.getAllByRole("alert").map((e) => e.textContent)).toEqual(["Refused", "Name is taken"]);
    expect(screen.getByRole("link", { name: "Open Admin" }).getAttribute("href")).toBe("/admin?tab=models");
    expect(screen.getByRole("status", { name: "Loading parts" })).toBeTruthy();
  });
  it("gives a panel a labelled region in both forms", () => {
    render(<><Panel title="One">a</Panel><Panel title="Two" compact id="two" description="note">b</Panel></>);
    expect(screen.getByRole("region", { name: "One" })).toBeTruthy();
    expect(screen.getByRole("region", { name: "Two" }).id).toBe("two");
  });
});

describe("helpers", () => {
  it("slugs, sizes, minutes and counts", () => {
    expect(slugify("Meta Feed #2!")).toBe("meta-feed-2");
    expect(slugify("Café déjà vu")).toBe("cafe-deja-vu");
    expect(fileSlug("???")).toBe("concept");
    expect(fmtBytes(1536)).toBe("1.5 KB");
    expect(fmtMinutes(430)).toBe("7 h 10 min");
    expect(plural(1, "part")).toBe("1 part");
    expect(plural(1200, "part")).toBe("1,200 parts");
  });
  it("downloads through one link", () => {
    const create = vi.fn(() => "blob:x");
    vi.stubGlobal("URL", Object.assign(URL, { createObjectURL: create, revokeObjectURL: vi.fn() }));
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
    downloadFile("a.csv", "x,y", "text/csv");
    expect(create).toHaveBeenCalled();
    expect(click).toHaveBeenCalled();
    click.mockRestore();
  });
});
