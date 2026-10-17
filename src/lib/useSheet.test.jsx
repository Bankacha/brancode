// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { useRef } from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useNavigate } from "react-router";
import { useSheet } from "./useSheet.js";

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
