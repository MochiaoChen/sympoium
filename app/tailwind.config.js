/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: ["class"],
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        // ─── Paper & Ink (UI Guideline v1.0) ─────────────────────────────
        paper: {
          DEFAULT: '#F7F4ED',
          surface: '#FBF9F3',
          white: '#FFFFFF',
          border: '#E8E3D8',
        },
        ink: {
          1: '#1C1A18',
          2: '#4A4641',
          3: '#8A847C',
          4: '#B8B1A5',
        },
        // ─── Brand ───────────────────────────────────────────────────────
        crimson: {
          DEFAULT: '#5D2A2C',
          light: '#8B4548',
          dark: '#3D1B1D',
          paper: '#F4E8E6',
        },
        // ─── Agents ──────────────────────────────────────────────────────
        agent: {
          observer: '#4A6B8A',      // 望气者
          cartographer: '#3D5C42',  // 测绘师
          challenger: '#A53A2C',    // 问难者
          scribe: '#2B2A28',        // 执笔者
          critic: '#8B6B3A',        // 校雠
          host: '#0066FF',          // 刘看山
          // 众生圈（泛知识示例）
          student: '#1F3A5F',
          troll: '#6B2C2E',
          empath: '#8B5A6B',
          quoter: '#F0B62F',
          scroller: '#888888',
          kol: '#2E8B6F',
        },
        // ─── Heatmap (Act 5) ─────────────────────────────────────────────
        heat: {
          1: '#C8D4E0', // 极冷
          2: '#DFE2DD', // 偏冷
          3: '#F2EFE7', // 中性
          4: '#E8D5B7', // 偏暖
          5: '#D9B88E', // 极暖
        },
        // ─── Functional ──────────────────────────────────────────────────
        success: '#4A6B42',
        warning: '#A07535',
        error: '#8B3A2C',
        info: '#4A6B8A',
        // ─── shadcn compat ───────────────────────────────────────────────
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive) / <alpha-value>)",
          foreground: "hsl(var(--destructive-foreground) / <alpha-value>)",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
      },
      fontFamily: {
        serif: ['"Noto Serif SC"', '"Source Han Serif SC"', 'Lora', 'serif'],
        sans: ['"Noto Sans SC"', '"Source Han Sans SC"', '"IBM Plex Sans"', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'monospace'],
      },
      fontSize: {
        display: ['44px', { lineHeight: '1.2', letterSpacing: '0.02em' }],
        h1: ['32px', { lineHeight: '1.3', letterSpacing: '0.02em' }],
        h2: ['24px', { lineHeight: '1.4', letterSpacing: '0.02em' }],
        h3: ['20px', { lineHeight: '1.5', letterSpacing: '0.02em' }],
        'body-lg': ['18px', { lineHeight: '1.75', letterSpacing: '0.02em' }],
        body: ['16px', { lineHeight: '1.7', letterSpacing: '0.02em' }],
        ui: ['14px', { lineHeight: '1.5' }],
        caption: ['13px', { lineHeight: '1.5' }],
        micro: ['12px', { lineHeight: '1.4' }],
      },
      spacing: {
        1: '4px',
        2: '8px',
        3: '12px',
        4: '16px',
        6: '24px',
        8: '32px',
        12: '48px',
        16: '64px',
        24: '96px',
        32: '128px',
      },
      maxWidth: {
        'prose-narrow': '600px',
        'prose-default': '720px',
        'prose-wide': '960px',
        canvas: '1200px',
      },
      borderRadius: {
        DEFAULT: '4px',
        none: '0px',
        md: '6px',
        lg: '8px',
        xl: '12px',
        full: '9999px',
      },
      transitionTimingFunction: {
        signature: 'cubic-bezier(0.22, 0.61, 0.36, 1)',
      },
      keyframes: {
        'accordion-down': {
          from: { height: '0' },
          to: { height: 'var(--radix-accordion-content-height)' },
        },
        'accordion-up': {
          from: { height: 'var(--radix-accordion-content-height)' },
          to: { height: '0' },
        },
      },
      animation: {
        'accordion-down': 'accordion-down 0.2s ease-out',
        'accordion-up': 'accordion-up 0.2s ease-out',
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
}
