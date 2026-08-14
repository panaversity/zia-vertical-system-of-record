/**
 * shadcn/ui — button.
 *
 * Copied from ag2 apps/learn-app at d764f334 (src/components/ui/button.tsx),
 * byte-for-byte except the `@/lib/utils` alias, rewritten relative because this
 * package ships no path aliases — and except the reset at the head of the base
 * variant string, added 2026-08-14 and marked below. Upstream gets that reset
 * from Tailwind's preflight; this package cannot ship preflight (src/css/
 * tailwind.css records why in full), so the two elements the button relies on —
 * `background-color: transparent` and `border: 0` — are named here. Without
 * them a ghost button renders with the browser's own grey face and 2px outset
 * border. Both sit FIRST in the string, so every variant below overrides them
 * through tailwind-merge in the normal way.
 *
 * Kept because every piece of kept chrome uses it: the navbar, the footer, the
 * doc-page actions and the homepage hero.
 *
 * Deliberately canonical: this is the file shadcn itself generates, so an agent
 * asked to restyle a vsor site edits something its training data already knows.
 * Colours come from the token layer (src/css/tokens.css) through the utility
 * mapping in src/css/tailwind.css — no literal ever appears here.
 */
import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "../lib/utils"

const buttonVariants = cva(
  // `border-0 bg-transparent [font-family:inherit] cursor-pointer` = the
  // preflight replacement (see the header note); everything after it is
  // upstream's string, unchanged.
  "border-0 bg-transparent [font-family:inherit] cursor-pointer inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary/90",
        destructive:
          "bg-destructive text-destructive-foreground hover:bg-destructive/90",
        outline:
          "border border-input bg-background hover:bg-accent hover:text-accent-foreground",
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-secondary/80",
        ghost: "hover:bg-accent hover:text-accent-foreground",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-9 rounded-md px-3",
        lg: "h-11 rounded-md px-8",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button"
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"

export { Button, buttonVariants }
