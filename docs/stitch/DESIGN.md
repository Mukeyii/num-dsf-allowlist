# Design System Specification: Medical Research Data Network

## 1. Overview & Creative North Star
**Creative North Star: The Clinical Curator**
In the high-stakes environment of medical research, "standard SaaS" is a liability. This design system moves beyond the generic dashboard aesthetic to embrace **The Clinical Curator**—a visual philosophy that prioritizes hyper-legibility, quiet authority, and a layered, editorial approach to data.

The system breaks the "template" look by rejecting the rigid 1px grid in favor of **intentional asymmetry** and **tonal depth**. By using overlapping surfaces and high-contrast typography scales, we create an environment that feels like a premium workspace rather than a basic database. It is precise, sterile but welcoming, and intentionally sophisticated.

---

## 2. Colors & Surface Philosophy
The palette is grounded in a foundation of cool neutrals, punctuated by highly specific entity accents that act as visual anchors for researchers navigating complex datasets.

### Color Tokens (Material-Derivative)
*   **Primary (Indigo-Violet):** `#4d41df` — Used for core actions and system identifiers.
*   **Secondary (Teal):** `#006b5a` — Represents operational stability and "Endpoints."
*   **Tertiary (Amber/Coral):** `#805200` / `#ba1a1a` — Reserved for "Certificates" and "Approvals."
*   **Background:** `#f7f9ff` — A luminous, cool-toned base.

### The "No-Line" Rule
Standard 1px borders are prohibited for sectioning. Boundaries must be defined solely through background color shifts. For example, a `surface-container-low` section sitting on a `surface` background provides all the definition needed without the visual "noise" of a stroke.

### Surface Hierarchy & Nesting
Treat the UI as a physical stack of fine paper or frosted glass. Use the hierarchy below to define importance:
1.  **Surface (Base):** `#f7f9ff` — The bottom-most layer.
2.  **Surface-Container-Low:** `#f1f3f9` — Large layout sections.
3.  **Surface-Container-Lowest:** `#ffffff` — Primary content cards and elevated data panels.

### The "Glass & Gradient" Rule
To elevate the experience, floating elements (modals, dropdowns) should utilize **Glassmorphism**. Apply a semi-transparent surface color with a `backdrop-blur` of 12px–20px. 
*   **Signature Texture:** Main CTAs should use a subtle linear gradient from `primary` (#4d41df) to `primary_container` (#675df9) at a 135° angle to provide depth that flat colors cannot achieve.

---

## 3. Typography
We utilize **Inter** to bridge the gap between technical precision and editorial elegance.

*   **Display/Headline:** Use `headline-sm` (1.5rem) for page-level contexts. The generous tracking and scale provide an authoritative "Digital Journal" feel.
*   **Title (Editorial):** `title-sm` (1rem, Bold) in `primary` (#4d41df) for page titles. This creates an immediate focal point.
*   **Body (Functional):** `body-md` (0.875rem) for general content.
*   **Monospace Utility:** Use `label-sm` (0.6875rem) in a Monospace font-family specifically for `primary` tinted identifiers and IDs. This signals "data-integrity" to the user.

---

## 4. Elevation & Depth
Depth is achieved through **Tonal Layering** rather than traditional structural lines.

### The Layering Principle
Stack containers to create "soft lift."
*   **Level 0:** `surface` (Background)
*   **Level 1:** `surface-container-low` (Navigation sidebar/header)
*   **Level 2:** `surface-container-lowest` (Main content cards)

### Ambient Shadows
Shadows must be invisible until they are needed. When a "floating" effect is required (e.g., a dragged file or a modal):
*   **Blur:** 24px–40px
*   **Opacity:** 4%–7%
*   **Color:** Use a tinted version of `on_surface` (deep navy) rather than pure black to keep the shadows "airy."

### The "Ghost Border" Fallback
If a border is required for accessibility, it must be a **Ghost Border**: `outline-variant` (#c7c4d8) at **15% opacity**. 100% opaque, high-contrast borders are strictly forbidden.

---

## 5. Components

### Buttons & Chips
*   **Primary Action:** Gradient-filled (Primary to Primary-Container) with a `lg` (1rem) radius.
*   **Entity Chips:** Use specific entity accents with a 10% opacity background of the same hue (e.g., Organization #6c63ff at 10% bg, 100% text).
*   **Radius:** Standard buttons use `md` (0.75rem); Cards use `xl` (1.5rem) to emphasize the "Modern SaaS" aesthetic.

### Input Fields
*   **Style:** `surface-container-lowest` background with a subtle `outline-variant` Ghost Border.
*   **Focus State:** Shift the border to 100% opacity `primary` and add a 2px `surface_tint` outer glow.

### Cards & Lists (The "No Divider" Rule)
Forbid the use of horizontal divider lines. Separate list items using:
1.  **Vertical White Space:** Use the `4` (0.9rem) or `5` (1.1rem) spacing tokens.
2.  **Alternating Tones:** Use subtle shifts between `surface-container-lowest` and `surface-container-low` for alternating rows.

### Relevant App-Specific Components
*   **The Identifier Badge:** A small, indigo-tinted monospace tag for "DSF IDs."
*   **Status Orbit:** A pulsing, low-opacity glow behind status icons (e.g., a Teal glow for an "Active" Endpoint) to indicate live network connectivity.

---

## 6. Do's and Don'ts

### Do
*   **Do** use asymmetrical margins to create an editorial feel (e.g., a wider left margin for page titles).
*   **Do** utilize `backdrop-blur` on navigation overlays to maintain context.
*   **Do** rely on typography weight (Semibold vs Regular) to establish hierarchy before reaching for color.

### Don't
*   **Don't** use 1px solid #CCCCCC or similar high-contrast borders.
*   **Don't** use standard "Drop Shadows" (0 2px 4px black).
*   **Don't** cram data. If a table feels crowded, increase the row height using the `10` (2.25rem) spacing token.
*   **Don't** use pure black (#000000) for text. Always use `on_surface` (#181c20).