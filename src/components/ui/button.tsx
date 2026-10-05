import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

/**
 * Primary is Ranting navy; outline is the secondary (white, subtle border); destructive is a
 * restrained red outline so delete/void/archive actions don't shout. Sizes: default 44px, sm 36px,
 * icon (36px square; give it an aria-label).
 */
const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl text-sm font-semibold transition-[color,background-color,border-color,box-shadow] duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:pointer-events-none disabled:opacity-50 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "bg-navy text-white shadow-[0_1px_2px_#071e3029] hover:bg-navy-hover",
        outline: "border border-border bg-white text-foreground shadow-[0_1px_2px_#071e300d] hover:border-[#c9d5da] hover:bg-slate-50",
        ghost: "text-slate-700 hover:bg-muted hover:text-foreground",
        destructive: "border border-red-200 bg-white text-red-700 hover:border-red-300 hover:bg-red-50",
      },
      size: {
        default: "min-h-11 px-5 py-2.5",
        sm: "min-h-9 px-3 py-1.5 text-[0.8125rem]",
        icon: "size-9 min-h-9 p-0",
      },
    },
    defaultVariants: { variant: "default", size: "default" },
  },
);
function Button({ className, variant, size, asChild = false, ...props }: React.ComponentProps<"button"> & VariantProps<typeof buttonVariants> & { asChild?: boolean }) { const Comp = asChild ? Slot : "button"; return <Comp data-slot="button" className={cn(buttonVariants({ variant, size, className }))} {...props} />; }
export { Button, buttonVariants };
