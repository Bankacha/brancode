// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter, useNavigate } from "react-router";
import { useSheet } from "./useSheet.js";

function Probe() {
  const sheet = useSheet();
  const navigate = useNavigate();
  return (
    <div>
      <output>{sheet.name ?? "none"}</output>
      <button onClick={() => sheet.open("menu")}>open menu</button>
      <button onClick={() => sheet.open("confirm")}>open confirm</button>
      <button onClick={() => sheet.close()}>close</button>
      <button onClick={() => navigate(-1)}>system back</button>
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
});
