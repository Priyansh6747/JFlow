
---

## 1. Core Neutrals (Foundation)

These define the *dark-mode first* aesthetic.

### 🖤 Absolute Black

* **HEX:** `#000000`
* **RGB:** `0, 0, 0`
* **Usage:**

    * Primary app background
    * Status bar / safe area
* **Notes:** Pure black → premium OLED look, maximum contrast

---

### 🌑 Near Black (Primary Surface)

* **HEX:** `#181818`
* **RGB:** `24, 24, 24`
* **Usage:**

    * Card backgrounds
    * Main containers
    * Navigation bars
* **Contrast:** WCAG AAA with light text
* **Why:** Softer than pure black → reduces eye strain

---

### 🌘 Deep Charcoal

* **HEX:** `#030306`
* **RGB:** `3, 3, 6`
* **Usage:**

    * Secondary panels
    * Inner cards
    * Modal backgrounds
* **Why:** Adds depth layering without visible borders

---

## 2. Light Neutrals (Text & UI Balance)

Used to prevent the UI from feeling too heavy.

### 🩶 Medium Gray (Background Canvas)

* **HEX:** `#B6B6B6`
* **RGB:** `182, 182, 182`
* **Usage:**

    * App preview background
    * Marketing mockups
* **Not for production UI backgrounds**

---

### 🤍 Soft Light Gray

* **HEX:** `#E0E0E0`
* **RGB:** `224, 224, 224`
* **Usage:**

    * High-emphasis text
    * Icon highlights
    * Active states on dark surfaces

---

## 3. Brand Accent (Primary Signature Color)

### 🌿 Muted Teal / Sage

* **HEX:** `#889B9A`
* **RGB:** `136, 155, 154`
* **Usage:**

    * Primary CTAs
    * Highlights
    * Selected states
    * Graph indicators
* **Emotional Tone:** Calm, premium, analytical
* **Why it works:**

    * Low saturation → elegant
    * Pairs perfectly with black UI
    * Non-aggressive (great for dashboards)

---

## 4. Text Color System

### Primary Text

* **HEX:** `#FFFFFF`
* **RGB:** `255, 255, 255`
* **Usage:** Headings, key metrics

### Secondary Text

* **HEX:** `#B3B3B3`
* **RGB:** `179, 179, 179`
* **Usage:** Labels, helper text

### Disabled / Muted Text

* **HEX:** `#6F6F6F`
* **RGB:** `111, 111, 111`
* **Usage:** Inactive buttons, placeholders

---

## 5. UI States

### Active / Selected

* **Fill:** `#889B9A`
* **Text:** `#000000`
* **Border:** none (relies on contrast)

### Hover

* **Overlay:** `rgba(255,255,255,0.04)`

### Pressed

* **Overlay:** `rgba(0,0,0,0.25)`

---

## 6. Data Visualization Palette

Optimized for dark dashboards:

| Role          | HEX       | RGB         |
| ------------- | --------- | ----------- |
| Primary Bar   | `#889B9A` | 136,155,154 |
| Secondary Bar | `#5F6F6E` | 95,111,110  |
| Grid Lines    | `#1E1E1E` | 30,30,30    |
| Labels        | `#B6B6B6` | 182,182,182 |

---

## 7. CSS Variables (Drop-in Ready)

```css
:root {
  --black: #000000;
  --surface-primary: #181818;
  --surface-secondary: #030306;

  --accent-primary: #889B9A;

  --text-primary: #FFFFFF;
  --text-secondary: #B3B3B3;
  --text-muted: #6F6F6F;

  --ui-light: #E0E0E0;
  --ui-gray: #B6B6B6;
}
```

---

## 8. Design Philosophy Summary

* **Dark-first, OLED-friendly**
* **No hard borders → depth via shade**
* **Muted accent avoids visual fatigue**
* **Enterprise + premium SaaS feel**
* **Perfect for dashboards, planners, analytics**


