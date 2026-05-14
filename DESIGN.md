---
name: Glow Beauty AI
colors:
  surface: '#f9f9f9'
  surface-dim: '#dadada'
  surface-bright: '#f9f9f9'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f3f3f4'
  surface-container: '#eeeeee'
  surface-container-high: '#e8e8e8'
  surface-container-highest: '#e2e2e2'
  on-surface: '#1a1c1c'
  on-surface-variant: '#4c4546'
  inverse-surface: '#2f3131'
  inverse-on-surface: '#f0f1f1'
  outline: '#7e7576'
  outline-variant: '#cfc4c5'
  surface-tint: '#5e5e5e'
  primary: '#000000'
  on-primary: '#ffffff'
  primary-container: '#1b1b1b'
  on-primary-container: '#848484'
  inverse-primary: '#c6c6c6'
  secondary: '#735c00'
  on-secondary: '#ffffff'
  secondary-container: '#fed65b'
  on-secondary-container: '#745c00'
  tertiary: '#000000'
  on-tertiary: '#ffffff'
  tertiary-container: '#1b1b1b'
  on-tertiary-container: '#848484'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#e2e2e2'
  primary-fixed-dim: '#c6c6c6'
  on-primary-fixed: '#1b1b1b'
  on-primary-fixed-variant: '#474747'
  secondary-fixed: '#ffe088'
  secondary-fixed-dim: '#e9c349'
  on-secondary-fixed: '#241a00'
  on-secondary-fixed-variant: '#574500'
  tertiary-fixed: '#e2e2e2'
  tertiary-fixed-dim: '#c6c6c6'
  on-tertiary-fixed: '#1b1b1b'
  on-tertiary-fixed-variant: '#474747'
  background: '#f9f9f9'
  on-background: '#1a1c1c'
  surface-variant: '#e2e2e2'
typography:
  display-lg:
    fontFamily: Playfair Display
    fontSize: 48px
    fontWeight: '700'
    lineHeight: '1.1'
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Playfair Display
    fontSize: 32px
    fontWeight: '600'
    lineHeight: '1.2'
  headline-lg-mobile:
    fontFamily: Playfair Display
    fontSize: 24px
    fontWeight: '600'
    lineHeight: '1.2'
  headline-md:
    fontFamily: Playfair Display
    fontSize: 24px
    fontWeight: '500'
    lineHeight: '1.3'
  body-lg:
    fontFamily: Inter
    fontSize: 18px
    fontWeight: '400'
    lineHeight: '1.6'
  body-md:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: '1.5'
  label-md:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '600'
    lineHeight: '1.4'
    letterSpacing: 0.05em
  label-sm:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '500'
    lineHeight: '1.4'
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  unit: 8px
  container-padding: 40px
  gutter: 24px
  margin-sm: 16px
  margin-md: 32px
  margin-lg: 64px
---

## Brand & Style
The brand personality is the "Digital Concierge"—an intersection of high-end clinical expertise and cutting-edge artificial intelligence. It evokes a sense of calm, exclusivity, and precision. The target audience includes luxury spa owners and medical aesthetic practitioners who demand a tool that reflects the premium nature of their services.

The design style is **Modern Luxury SaaS**, blending **Minimalism** with subtle **Glassmorphism**. It utilizes expansive white space, a restricted high-contrast palette, and refined elevation to create a workspace that feels less like a database and more like a curated editorial experience.

## Colors
The palette is rooted in a "Noir et Blanc" foundation to establish authority and clarity.
- **Primary (Deep Black):** Used for primary typography and core structural elements to anchor the UI.
- **Secondary (Sophisticated Gold):** Reserved for high-value actions, active states, and "Premium" indicators. It should be used sparingly as an accent to maintain its impact.
- **Surface:** The default background is a soft, off-white (#F9F9F7) to reduce eye strain compared to pure white, while pure white is used for elevated cards and components.

## Typography
The typographic scale relies on a sharp contrast between the serif display face and the sans-serif functional face. 
- **Playfair Display** is used for page titles, section headers, and data highlights (like "Today's Revenue") to inject a "vogue" editorial feel.
- **Inter** handles all utility-based content, navigation, and data entry. 
- **Letter Spacing:** Labels use a slight positive tracking and uppercase styling to provide a modern, architectural feel to the dashboard's metadata.

## Layout & Spacing
The layout follows a **Fixed-Fluid Hybrid** model. The side navigation is fixed at 280px, while the main content area expands to fill the viewport but caps at 1440px to ensure line lengths remain readable.

- **The 8px Grid:** All components and internal spacing must be multiples of 8.
- **Generous Margins:** Unlike dense enterprise SaaS, this design system prioritizes "breathing room." Use `margin-lg` between major sections to emphasize the luxury aesthetic.
- **Mobile Reflow:** On mobile, the 12-column desktop grid collapses to a single column with 20px side margins.

## Elevation & Depth
Hierarchy is established through **Ambient Shadows** and **Tonal Layers**.
- **Level 0 (Background):** Soft tinted white.
- **Level 1 (Cards):** Pure white surfaces with a 1px border of #EEEEEE and a very soft, large-radius shadow (0px 10px 30px rgba(0,0,0,0.03)).
- **Level 2 (Glass Overlays):** Used for modals and dropdowns. Features a `backdrop-filter: blur(12px)` with a 70% white opacity. This creates the "glassmorphism" effect requested, suggesting a modern, airy feel.
- **Accent Depth:** The Gold (#D4AF37) should never have a shadow; it should sit flat on top of surfaces to act as a precision highlight.

## Shapes
The design system utilizes **large, soft rounded corners** to convey an approachable and organic "beauty" feel, moving away from the clinical sharpness of traditional medical software.
- **Components:** Primary buttons and inputs use a 0.5rem (8px) radius.
- **Containers:** Main dashboard cards and content modules use `rounded-xl` (1.5rem / 24px) to create a soft framing effect.
- **Interactive States:** Hover states should subtly increase the perceived depth rather than changing the shape.

## Components
- **Buttons:** 
  - *Primary:* Solid Deep Black with White text. No border.
  - *Secondary:* 1px Gold border with Gold text. 
  - *Tertiary:* Ghost style, Black text, Gold underline on hover.
- **Cards:** White background, 24px corner radius, subtle 1px border. Headlines inside cards must use Playfair Display.
- **Input Fields:** Minimalist design. A bottom-only 1px border that turns Gold on focus. Labels should be small, uppercase Inter.
- **Chips/Badges:** For status (e.g., "Confirmed," "AI Processing"). Use very light grey backgrounds with black text. Use the Gold color only for "VIP" or "Urgent" statuses.
- **AI Concierge Interface:** A specialized chat-style list component. User messages in White cards; AI responses in subtly tinted Glassmorphic cards with a Gold left-accent border.
- **Lists:** High row height (64px+) with generous horizontal padding. Use thin, light dividers (#F0F0F0) that do not touch the container edges.