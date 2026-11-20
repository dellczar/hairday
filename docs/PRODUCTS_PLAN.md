# Salon products — plan ("Add to your visit")

**Status:** idea, approved for planning on 2026-11-19. **Not scheduled.** Build it after the store release (Phase 8), once real salons are live. Nothing here is built yet.

## The idea in one line

Salons list the products they sell in the shop. Customers add them to a booking, pay with the same saved card after the visit, and pick them up at the appointment. Hairday takes a commission.

## Why this version first

A full online shop (shipping to homes) means shipping and returns, sales tax in many states, cosmetics labeling rules, stock tracking and customer service — a second business. Picking up in the salon avoids almost all of that:

| | Pick up in the salon (this plan) | Ship to the customer (later, maybe) |
|---|---|---|
| Shipping, tracking, lost parcels | None | Needed |
| Returns | Handled in person by the salon | Needed |
| Sales tax | The salon's normal in-shop sales | Hairday may have to collect and pay tax in many states (marketplace rules) |
| Stock | Salon checks the shelf before the visit | Must be exact |
| Payment | Same saved card, charged after the visit | Charged at checkout |
| Size of the work | About one phase (like Phase 7) | Several phases plus a tax service |

## What customers see

1. **Salon page → new "Shop" tab** (next to Services / Team / Reviews / About): product photo, name, size, price, "Add to your visit".
2. **Pick a time / Review & pay:** an optional "Add products" row; products show in the summary with their own line and total.
3. **"You're booked"** and **My bookings:** products listed under the visit, with "Remove" until 24 hours before (same rule as free cancelling).
4. **After the visit:** the review request can include "April used this — add it to your next visit."
5. **Receipt / email:** services, products, tip and total, each on its own line.

## What salon owners see

1. **Business → Products:** add, edit, hide or delete a product (photo, name, size, price, short description, "in stock" switch).
2. **Today / booking sheet:** a "Products to set aside" list for each visit, so they can have them ready.
3. **At checkout in the salon:** mark each product **Given** or **Not available** (not charged if not available).
4. **Payouts:** product sales arrive with the visit's payout, minus Hairday's product commission.

## Money rules (draft — owner to confirm)

- Products are charged **with the visit**, after it, to the saved card. Tips stay on services only.
- **Not given = not charged.** Only products marked Given are charged.
- **Cancelled visit = products cancelled too**, never charged.
- **No-show:** products are not charged (only the service no-show fee).
- **Returns:** handled by the salon in person; refunds go through the same Stripe refund flow, commission refunded proportionally.
- **Commission:** separate from the booking fee — see open questions.

## What it touches in the app

- **Database (new migration):** `products` (business, name, size, price_cents, photo, description, in_stock, is_visible, sort), `booking_products` (booking, product, quantity, price_cents at time of booking, status: reserved / given / unavailable / cancelled). Row Level Security: anyone can read visible products; only the salon's owner can edit them; customers can add/remove products on their own upcoming bookings. A test for each policy.
- **Server functions:** the after-visit charge adds the "given" products to the amount and the commission to `application_fee_amount`; cancellation and refund paths include products.
- **Screens:** Salon "Shop" tab, product sheet, Pick a time / Review & pay summary, My bookings, owner Products list + edit sheet, booking sheet "set aside" list.
- **Notifications:** the 24-hour reminder mentions the products; owners' daily summary counts products to set aside.
- **Designs:** new screens need design references first (`design/screens/Shop.html`, `Products.html`), matching the current look.

## Rules from the app stores and the law

- **Apple / Google:** physical products used outside the app are paid through Stripe, not in-app purchase (Apple guideline 3.1.3(e), "Goods and Services Outside of the App"), same as bookings. Allowed.
- **Sales tax:** with in-salon pickup, the salon is the seller and charges its normal sales tax. *Check with an accountant before launch* whether Hairday's role (processing the payment) changes this in New York and any other launch state.
- **Product safety:** salons are responsible for what they sell; the owner terms should say so. Hairday removes listings that are reported as unsafe or fake.

## Open questions (owner decides before building)

1. **Commission on products:** a percentage (for example 5–10%) or none at launch to win salons over?
2. **Who can sell:** every salon, or only salons that ask for it?
3. **Product photos:** required (at least one), or optional?
4. **Quantity limits:** cap per visit (for example 5 of each)?
5. **Later:** ship to home at all, and if so, through which tax service (a paid service — ask first)?

## Rough order of work (when it's scheduled)

1. Design references for the new screens → owner approves.
2. Migration + Row Level Security + tests.
3. Owner Products screens.
4. Customer Shop tab and "Add to your visit".
5. Charging, cancelling and refunds with products, plus tests.
6. Notifications and emails.
7. Test on both phones, accessibility pass, show the owner.
