import { createStore } from "zustand/vanilla";
import { z } from "zod";

const UNIT_PRICE_CENTS: Record<number, number> = { 1: 2999, 2: 2699, 3: 2399 };
const SHIPPING_CENTS = 599;
const DISCOUNT_RATE = 0.15;
const MIN_QTY = 1;

interface CheckoutState {
  qty: number;
  subscribed: boolean;
}

export const checkoutStore = createStore<CheckoutState>()(() => ({
  qty: 1,
  subscribed: true,
}));

export const setQty = (qty: number) =>
  checkoutStore.setState({ qty: Math.max(MIN_QTY, qty) });

export const setSubscribed = (subscribed: boolean) =>
  checkoutStore.setState({ subscribed });

function unitPriceCents(qty: number): number {
  if (qty <= 1) return UNIT_PRICE_CENTS[1];
  if (qty === 2) return UNIT_PRICE_CENTS[2];
  return UNIT_PRICE_CENTS[3];
}

function subtotalCents(state: CheckoutState): number {
  return unitPriceCents(state.qty) * state.qty;
}

function discountCents(state: CheckoutState): number {
  return state.subscribed
    ? Math.round(subtotalCents(state) * DISCOUNT_RATE)
    : 0;
}

function totalCents(state: CheckoutState): number {
  return subtotalCents(state) - discountCents(state) + SHIPPING_CENTS;
}

function formatUSD(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

function setText(selector: string, text: string) {
  document.querySelectorAll<HTMLElement>(selector).forEach((el) => {
    el.textContent = text;
  });
}

function render(state: CheckoutState) {
  const unit = formatUSD(unitPriceCents(state.qty));
  const subtotal = formatUSD(subtotalCents(state));
  const total = formatUSD(totalCents(state));

  setText("[data-qty-value]", String(state.qty));
  document
    .querySelectorAll<HTMLButtonElement>("[data-qty-decrement]")
    .forEach((btn) => {
      btn.disabled = state.qty <= MIN_QTY;
    });

  setText("[data-unit-price]", unit);
  setText(
    "[data-summary-name]",
    `Calm Chews — ${state.qty} ${state.qty === 1 ? "bag" : "bags"}`,
  );
  setText("[data-summary-unit]", `${unit} × ${state.qty}`);
  setText("[data-summary-subtotal]", subtotal);

  document
    .querySelectorAll<HTMLElement>("[data-discount-group]")
    .forEach((el) => {
      el.classList.toggle("hidden", !state.subscribed);
    });
  setText(
    '[data-value="discount-value"]',
    `-${formatUSD(discountCents(state))}`,
  );
  setText("[data-total-value]", total);

  setText(
    "[data-cta-label]",
    state.subscribed
      ? `Subscribe & Save — ${total}`
      : `Complete Order — ${total}`,
  );

  document
    .querySelectorAll<HTMLButtonElement>("[data-subscribe-toggle]")
    .forEach((btn) => {
      btn.setAttribute("aria-checked", String(state.subscribed));
      btn.classList.toggle("bg-primary", state.subscribed);
      btn.classList.toggle("bg-border", !state.subscribed);
      btn
        .querySelectorAll<HTMLElement>("[data-subscribe-knob]")
        .forEach((knob) => {
          knob.classList.toggle("translate-x-1", !state.subscribed);
          knob.classList.toggle("translate-x-6", state.subscribed);
        });
    });
}

checkoutStore.subscribe(render);

const shippingSchema = z.object({
  name: z.string().trim().min(1, "Please enter your full name"),
  email: z.email({ error: "Please enter a valid email address" }),
  street: z.string().trim().min(1, "Please enter your street address"),
});

function validateField(input: HTMLInputElement): boolean {
  const rule =
    shippingSchema.shape[input.name as keyof typeof shippingSchema.shape];
  if (!rule) return true;

  const result = rule.safeParse(input.value);
  const field = input.closest<HTMLElement>("[data-field]");
  const errorEl = field?.querySelector<HTMLElement>("[data-error]");
  const wrapper = field?.querySelector<HTMLElement>("[data-input-wrapper]");

  if (errorEl) {
    errorEl.textContent = result.success ? "" : result.error.issues[0].message;
    errorEl.classList.toggle("hidden", result.success);
  }
  if (wrapper) {
    wrapper.classList.toggle("border-red-500", !result.success);
    wrapper.classList.toggle("border-border", result.success);
  }
  input.setAttribute("aria-invalid", String(!result.success));
  return result.success;
}

function initForm() {
  const form = document.querySelector<HTMLFormElement>("[data-checkout-form]");
  if (!form) return;

  const inputs = Array.from(
    form.querySelectorAll<HTMLInputElement>("input[name]"),
  );

  inputs.forEach((input) => {
    input.addEventListener("blur", () => validateField(input));
  });

  form.addEventListener("submit", (event) => event.preventDefault());

  const validateAll = (): HTMLInputElement | null => {
    let firstInvalid: HTMLInputElement | null = null;
    inputs.forEach((input) => {
      const valid = validateField(input);
      if (!valid && !firstInvalid) firstInvalid = input;
    });
    return firstInvalid;
  };

  document.querySelectorAll<HTMLButtonElement>("[data-cta]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const firstInvalid = validateAll();
      if (firstInvalid) {
        firstInvalid.focus();
        firstInvalid.scrollIntoView({ behavior: "smooth", block: "center" });
        return;
      }
      console.log(
        "order submitted",
        Object.fromEntries(new FormData(form).entries()),
      );
    });
  });
}

export function initCheckout() {
  render(checkoutStore.getState());

  document
    .querySelectorAll<HTMLButtonElement>("[data-qty-increment]")
    .forEach((btn) => {
      btn.addEventListener("click", () =>
        setQty(checkoutStore.getState().qty + 1),
      );
    });
  document
    .querySelectorAll<HTMLButtonElement>("[data-qty-decrement]")
    .forEach((btn) => {
      btn.addEventListener("click", () =>
        setQty(checkoutStore.getState().qty - 1),
      );
    });
  document
    .querySelectorAll<HTMLButtonElement>("[data-subscribe-toggle]")
    .forEach((btn) => {
      btn.addEventListener("click", () =>
        setSubscribed(!checkoutStore.getState().subscribed),
      );
    });

  initForm();
}
