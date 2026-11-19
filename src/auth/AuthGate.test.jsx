// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, act } from "@testing-library/react";
import { MemoryRouter, useLocation } from "react-router";
import AuthGate from "./AuthGate.jsx";
import { supabase } from "../supabaseClient";

const auth = vi.hoisted(() => ({ session: null, listener: null }));
vi.mock("../supabaseClient", () => ({
  supabase: {
    auth: {
      getSession: vi.fn(async () => ({ data: { session: auth.session } })),
      onAuthStateChange: vi.fn((listener) => {
        auth.listener = listener;
        return { data: { subscription: { unsubscribe: vi.fn() } } };
      }),
      signInWithPassword: vi.fn(),
    },
  },
}));

function Where() {
  return <p>NA {useLocation().pathname}</p>;
}

const setup = (path) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <AuthGate>{() => <Where />}</AuthGate>
    </MemoryRouter>
  );

const SESSION = { user: { email: "brat@primer.test" }, access_token: "t" };

describe("AuthGate", () => {
  beforeEach(() => {
    auth.session = null;
    auth.listener = null;
    vi.clearAllMocks();
  });

  it("opens the home page after signing in, not the page the expired session was on", async () => {
    setup("/trebovanje/7");
    await screen.findByRole("button", { name: /Prijavi se/ });
    await act(async () => auth.listener("SIGNED_IN", SESSION));
    expect(screen.getByText("NA /")).toBeTruthy();
  });

  it("keeps the page when the app opens with a session still valid", async () => {
    auth.session = SESSION;
    setup("/trebovanje/7");
    await screen.findByText("NA /trebovanje/7");
    // Supabase repeats SIGNED_IN / TOKEN_REFRESHED while signed in (e.g. back to the tab)
    await act(async () => auth.listener("SIGNED_IN", SESSION));
    await act(async () => auth.listener("TOKEN_REFRESHED", SESSION));
    expect(screen.getByText("NA /trebovanje/7")).toBeTruthy();
    expect(supabase.auth.getSession).toHaveBeenCalledTimes(1);
  });

  it("shows the login screen again after signing out", async () => {
    auth.session = SESSION;
    setup("/popis");
    await screen.findByText("NA /popis");
    await act(async () => auth.listener("SIGNED_OUT", null));
    expect(screen.getByRole("button", { name: /Prijavi se/ })).toBeTruthy();
  });
});
