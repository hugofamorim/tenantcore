import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NativeSelect } from "./native-select";

describe("themed native selection", () => {
  it("preserves labels, form submission values and native reset", async () => {
    const { container } = render(
      <form>
        <label htmlFor="role">Invitation role</label>
        <NativeSelect id="role" name="role" defaultValue="MEMBER" required>
          <option value="MEMBER">MEMBER</option>
          <option value="VIEWER">VIEWER</option>
        </NativeSelect>
        <button type="reset">Reset</button>
      </form>,
    );
    const user = userEvent.setup();
    const control = screen.getByRole("combobox", { name: "Invitation role" });
    await user.selectOptions(control, "VIEWER");
    const form = container.querySelector("form");
    expect(form).not.toBeNull();
    if (!form) throw new Error("Expected rendered form");
    expect(new FormData(form).get("role")).toBe("VIEWER");
    await user.click(screen.getByRole("button", { name: "Reset" }));
    expect(control).toHaveValue("MEMBER");
  });

  it("preserves disabled state for pending mutations", async () => {
    render(
      <NativeSelect aria-label="Role" defaultValue="MEMBER" disabled>
        <option value="MEMBER">MEMBER</option>
        <option value="VIEWER">VIEWER</option>
      </NativeSelect>,
    );
    const control = screen.getByRole("combobox", { name: "Role" });
    await userEvent.setup().selectOptions(control, "VIEWER");
    expect(control).toBeDisabled();
    expect(control).toHaveValue("MEMBER");
  });
});
