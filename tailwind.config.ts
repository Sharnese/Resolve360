import type { Config } from "tailwindcss";
import animate from "tailwindcss-animate";
import typography from "@tailwindcss/typography";

export default {
  darkMode: ["class"],
  content: [
    "./pages/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./app/**/*.{ts,tsx}",
    "./src/**/*.{ts,tsx}",
  ],
  prefix: "",
  theme: {
    container: {
      center: true,
      padding: '2rem',
      screens: {
        '2xl': '1400px'
      }
    },
    extend: {
      colors: {
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))'
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))'
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))'
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))'
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))'
        },
        popover: {
          DEFAULT: 'hsl(var(--popover))',
          foreground: 'hsl(var(--popover-foreground))'
        },
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))'
        },
        sidebar: {
          DEFAULT: 'hsl(var(--sidebar-background))',
          foreground: 'hsl(var(--sidebar-foreground))',
          primary: 'hsl(var(--sidebar-primary))',
          'primary-foreground': 'hsl(var(--sidebar-primary-foreground))',
          accent: 'hsl(var(--sidebar-accent))',
          'accent-foreground': 'hsl(var(--sidebar-accent-foreground))',
          border: 'hsl(var(--sidebar-border))',
          ring: 'hsl(var(--sidebar-ring))'
        },
        // Brand palette — use sparingly and intentionally
        teal: {
          DEFAULT: 'hsl(var(--brand-teal))',
          foreground: 'hsl(var(--brand-teal-foreground))',
          soft: 'hsl(var(--brand-teal-soft))',
          50:  '#E8F2F1',
          100: '#CFE4E2',
          200: '#A6CECB',
          300: '#7DB8B4',
          400: '#4F9893',
          500: '#1F6F6B',
          600: '#1B6360',
          700: '#165451',
          800: '#114442',
          900: '#0C3331',
        },
        gold: {
          DEFAULT: 'hsl(var(--brand-gold))',
          foreground: 'hsl(var(--brand-gold-foreground))',
          50:  '#FBF4E1',
          100: '#F5E6BC',
          200: '#EDD18A',
          300: '#E2B85A',
          400: '#D6A23A',
          500: '#C99230',
          600: '#A8782A',
          700: '#825C20',
          800: '#5D4216',
          900: '#3A290D',
        },
        cream: {
          DEFAULT: 'hsl(var(--brand-cream))',
          foreground: 'hsl(var(--brand-cream-foreground))',
          50:  '#FBF8F1',
          100: '#F7F1E3',
          200: '#EFE6CE',
        },
        silver: {
          DEFAULT: 'hsl(var(--brand-silver))',
          foreground: 'hsl(var(--brand-silver-foreground))',
          50:  '#F5F6F7',
          100: '#E6E8EC',
          200: '#CDD1D7',
          300: '#B3B8C2',
          400: '#9AA0AC',
          500: '#7E8593',
        },
        charcoal: {
          DEFAULT: 'hsl(var(--brand-charcoal))',
          foreground: 'hsl(var(--brand-charcoal-foreground))',
        },
      },
      fontFamily: {

        mono: ['JetBrains Mono', 'monospace'],
        sans: ['Inter', 'sans-serif'],
      },
      borderRadius: {
        lg: 'calc(var(--radius) + 2px)',
        md: 'var(--radius)',
        sm: 'calc(var(--radius) - 2px)'
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
        'fade-in': {
          from: { opacity: '0' },
          to: { opacity: '1' },
        },
        'slide-in': {
          from: { transform: 'translateY(10px)', opacity: '0' },
          to: { transform: 'translateY(0)', opacity: '1' },
        },
      },
      animation: {
        'accordion-down': 'accordion-down 0.2s ease-out',
        'accordion-up': 'accordion-up 0.2s ease-out',
        'fade-in': 'fade-in 0.3s ease-out',
        'slide-in': 'slide-in 0.3s ease-out',
      },
      typography: {
        DEFAULT: {
          css: {
            maxWidth: 'none',
          },
        },
      },
    }
  },
  plugins: [
    animate,
    typography,
  ],
} satisfies Config;
