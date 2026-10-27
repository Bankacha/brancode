// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { useRef } from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation, useNavigate } from "react-router";
import { useDialog, useDropStaleSheet, useSheet } from "./useSheet.js";

function Probe() {
  const sheet = useSheet();
  const navigate = useNavigate();
  const firstOpen = useRef(sheet.open); // a closure from before any sheet was open, like one held across an await
  return (
    <div>
      <output>{sheet.name ?? "none"}</output>
      <button onClick={() => sheet.open("menu")}>open menu</button>
      <button onClick={() => sheet.open("confirm")}>open confirm</button>
      <button onClick={() => sheet.close()}>close</button>
      <button onClick={() => navigate(-1)}>system back</button>
      <button onClick={() => (sheet.close(), sheet.close())}>double close</button>
      <button onClick={() => firstOpen.current("leaflet")}>late open</button>
    </div>
  );
}

const setup = () =>
  render(
    <MemoryRouter initialEntries={["/"]}>
      <Probe />
    </MemoryRouter>
  );
const click = (label) => fireEvent.click(screen.getByText(label));
const shown = () => screen.getByRole("status").textContent;

describe("useSheet", () => {
  it("closes an open sheet on system back", () => {
    setup();
    click("open menu");
    expect(shown()).toBe("menu");
    click("system back");
    expect(shown()).toBe("none");
  });

  it("switches sheets in place so back doesn't return to the previous one", () => {
    setup();
    click("open menu");
    click("open confirm");
    expect(shown()).toBe("confirm");
    click("system back");
    expect(shown()).toBe("none");
  });

  it("close pops the sheet entry and does nothing more", () => {
    setup();
    click("open menu");
    click("close");
    expect(shown()).toBe("none");
    click("close");
    expect(shown()).toBe("none");
  });

  it("pops only one entry when close is called twice before the page updates", () => {
    render(
      <MemoryRouter initialEntries={["/elsewhere", "/"]} initialIndex={1}>
        <Routes>
          <Route path="/elsewhere" element={<p>ELSEWHERE</p>} />
          <Route path="/" element={<Probe />} />
        </Routes>
      </MemoryRouter>
    );
    click("open menu");
    click("double close");
    expect(shown()).toBe("none");
    expect(screen.queryByText("ELSEWHERE")).toBeNull();
  });

  it("replaces an open sheet even from a closure taken before it opened", () => {
    setup();
    click("open menu");
    click("late open");
    expect(shown()).toBe("leaflet");
    click("system back");
    expect(shown()).toBe("none");
  });
});

function DialogProbe() {
  const sheet = useSheet();
  const dialog = useDialog("copies");
  const navigate = useNavigate();
  return (
    <div>
      <output>{`${sheet.name ?? "none"} ${dialog.isOpen ? "copies" : "-"}`}</output>
      <button onClick={() => sheet.open("edit")}>open edit</button>
      <button onClick={() => dialog.open()}>open dialog</button>
      <button onClick={() => (dialog.close(), dialog.close())}>double close dialog</button>
      <button onClick={() => navigate(-1)}>system back</button>
    </div>
  );
}

describe("useDialog", () => {
  const setupDialog = () =>
    render(
      <MemoryRouter initialEntries={["/"]}>
        <DialogProbe />
      </MemoryRouter>
    );

  it("opens over a sheet, and back closes only the dialog", () => {
    setupDialog();
    click("open edit");
    click("open dialog");
    expect(shown()).toBe("edit copies");
    click("system back");
    expect(shown()).toBe("edit -");
    click("system back");
    expect(shown()).toBe("none -");
  });

  it("pops only its own entry when closed twice before the page updates", () => {
    setupDialog();
    click("open edit");
    click("open dialog");
    click("double close dialog");
    expect(shown()).toBe("edit -");
  });
});

function StaleProbe({ stale }) {
  useDropStaleSheet(stale);
  const location = useLocation();
  const navigate = useNavigate();
  return (
    <div>
      <output>{`${location.state?.sheet ?? "none"} ${location.state?.dialog ?? "-"}`}</output>
      <button onClick={() => navigate(-1)}>system back</button>
    </div>
  );
}

describe("useDropStaleSheet", () => {
  const renderAt = (entries, stale = true) =>
    render(
      <MemoryRouter initialEntries={entries} initialIndex={entries.length - 1}>
        <StaleProbe stale={stale} />
      </MemoryRouter>
    );

  it("drops a stale sheet and the copies window over it, so back doesn't land on the sheet", () => {
    renderAt(["/", { pathname: "/", state: { sheet: "edit" } }, { pathname: "/", state: { sheet: "edit", dialog: "copies" } }]);
    expect(shown()).toBe("none -");
    click("system back");
    expect(shown()).toBe("none -");
  });

  it("replaces a stale sheet entry in place, as before", () => {
    renderAt(["/", { pathname: "/", state: { sheet: "edit" } }]);
    expect(shown()).toBe("none -");
  });

  it("leaves a sheet that isn't stale alone", () => {
    renderAt(["/", { pathname: "/", state: { sheet: "edit" } }], false);
    expect(shown()).toBe("edit -");
  });
});
