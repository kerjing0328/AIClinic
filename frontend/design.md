---
version: 1.0.0
name: Modern Health Clinic System
description: Visual language for professional wellness clinics featuring soft blurs, grain textures, and high-contrast emerald typography.
colors:
  background: "#FAFAFA"
  primary: "#065F46"
  primary-light: "#D1FAE5"
  text-main: "#1A1A1A"
  text-muted: "#6B7280"
  border-glass: "rgba(255, 255, 255, 0.8)"
  accent-teal: "#0D9488"
  glow-emerald: "rgba(167, 243, 208, 0.8)"
  glow-sage: "rgba(110, 161, 137, 0.4)"
  glow-warm: "rgba(253, 230, 234, 0.8)"
typography:
  fontFamily: "Inter, sans-serif"
  h1:
    size: "3.75rem"
    weight: "600"
    letterSpacing: "-0.025em"
  h2:
    size: "2.25rem"
    weight: "600"
    letterSpacing: "-0.025em"
  label:
    size: "10px"
    weight: "700"
    letterSpacing: "0.25em"
    transform: "uppercase"
  body:
    size: "1rem"
    weight: "400"
    lineHeight: "1.625"
spacing:
  xs: "4px"
  sm: "8px"
  md: "16px"
  lg: "24px"
  xl: "40px"
  section: "80px"
rounded:
  sm: "8px"
  md: "12px"
  lg: "16px"
  xl: "24px"
  panel: "40px"
  full: "999px"
components:
  navbar:
    height: "auto"
    padding: "24px"
    blur: "24px"
  glass-panel:
    background: "rgba(255, 255, 255, 0.6)"
    border: "1px solid rgba(255, 255, 255, 0.8)"
    shadow: "0 8px 32px rgba(0, 0, 0, 0.04)"
  service-card:
    padding: "32px"
    hover-transform: "translateY(-8px)"
  primary-button:
    gradient: "linear-gradient(180deg, #F3F4F6 0%, #E5E7EB 100%)"
    letter-spacing: "0.1em"
motion:
  float: "8s ease-in-out infinite"
  fade-up: "0.8s cubic-bezier(0.16, 1, 0.3, 1)"
---
## Overview
The Modern Health Clinic visual system is built on a foundation of serenity and precision. It combines technical medical professionalism with an organic, human-centric feel through the use of soft-focus background glows and high-clarity glass elements.

## Colors
The palette is grounded in monochromatic greys with a sophisticated Emerald-to-Teal primary accent system. Backgrounds use a slightly off-white `#FAFAFA` to reduce eye strain, while interactive elements leverage semi-transparent whites to create depth.

## Typography
Inter is the sole typeface, utilized with varied weights to establish hierarchy. Large display headings use semi-bold weights with tight tracking, while functional labels and overlines use bold, wide-tracked uppercase styles to denote section headers and meta-info.

## Spacing
A strictly defined spacing system ensures consistent breathing room. Large-scale components like Hero sections and Gallery grids utilize 80px-120px vertical margins, while internal card components use 32px padding for a luxurious, uncluttered feel.

## Layout
The layout prioritizes a centralized max-width of 1280px (max-w-7xl). Content is arranged in layered stacks:
- **Background Layer**: Fixed grain texture and animated radial glows.
- **Midground Layer**: Large glass panels with integrated padding.
- **Foreground Layer**: Sticky navigation and floating action buttons.

## Elevation & Depth
Depth is achieved through `backdrop-filter: blur(24px)` and subtle `inset` shadows on glass panels. Shadows are never harsh black; instead, they use low-opacity greys (`rgba(0,0,0,0.04)`) to simulate the soft diffusion of light through frosted glass.

## Shapes
Shapes are defined by extremely high corner radii. Standard panels use 40px (2.5rem) or 48px (3rem) rounding, creating a friendly, non-clinical environment. Interactive elements like buttons and navigation pills use fully pill-shaped (999px) rounding.

## Components
- **Navbar**: A floating glass pill containing a high-contrast emerald logo mark and centered navigation links.
- **Hero Section**: A split-grid layout featuring a large-format image with an integrated secondary glass status badge.
- **Service Card**: A vertical stack with a custom gradient-icon container and hover-activated arrow animations.
- **Accordion**: Minimalist list style with circular toggle icons that rotate 180 degrees on state change.
- **Contact Form**: Utilizes input fields with `white/60` backgrounds and emerald-focus rings.

## Motion
- **BackgroundGlow**: Slow, looping radial translations (`animate-float`) simulate breathing.
- **Entrance**: Page elements utilize a `fade-in-up` animation with a custom cubic-bezier for a snappy yet smooth appearance.
- **Interactive**: Hover states on cards include a 20px blur expansion and a -8px vertical lift.

## Do's and Don'ts
- **Do**: Use high-quality photography with soft natural lighting.
- **Do**: Keep border weights at 1px for glass containers.
- **Don't**: Use solid, high-opacity colors for large containers; always prefer glassmorphism.
- **Don't**: Use sharp 90-degree corners; everything must be rounded.

## Accessibility
- Contrast is maintained by using `emerald-800` (dark green) for primary text actions against light backgrounds.
- Interactive icons include `aria-label` attributes for screen readers.
- Form fields use high-contrast placeholder text and explicit focus states.