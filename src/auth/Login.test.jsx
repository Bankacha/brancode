// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import Login from "./Login.jsx";
import { supabase } from "../supabaseClient";

vi.mock("../supabaseClient", () => ({
  supabase: { auth: { signInWithPassword: vi.fn(async () => ({ error: { message: "Invalid login credentials" } })) } },
}));

const submit = () => screen.getByRole("button", { name: /Prijavi se/ });

describe("Login", () => {
  it("greets the user and waits for both fields before allowing sign-in", () => {
    render(<Login />);
    expect(screen.getByText("Dobro jutro.")).toBeTruthy();
    expect(screen.queryByText("Pogrešan email ili lozinka.")).toBeNull();
    expect(submit().disabled).toBe(true);
    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "a@b.rs" } });
    expect(submit().disabled).toBe(true);
    fireEvent.change(screen.getByLabelText("Lozinka"), { target: { value: "tajna" } });
    expect(submit().disabled).toBe(false);
  });

  it("shows the error only after a failed sign-in", async () => {
    render(<Login />);
    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "  a@b.rs " } });
    fireEvent.change(screen.getByLabelText("Lozinka"), { target: { value: "tajna" } });
    fireEvent.click(submit());
    await waitFor(() => expect(screen.getByText("Pogrešan email ili lozinka.")).toBeTruthy());
    expect(supabase.auth.signInWithPassword).toHaveBeenCalledWith({ email: "a@b.rs", password: "tajna" });
  });
});
