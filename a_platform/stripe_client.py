"""Stripe payment links + webhook handling. Owned by Person A. Stub."""


def create_payment_link(product: dict) -> str:
    # TODO(A): stripe.PaymentLink.create(...)
    return ""


def handle_webhook(payload: bytes, sig_header: str) -> dict:
    # TODO(A): verify signature, record order
    return {"received": True}
