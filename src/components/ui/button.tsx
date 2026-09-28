import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";
const buttonVariants = cva("inline-flex items-center justify-center gap-2 rounded-xl text-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary disabled:opacity-50 disabled:pointer-events-none min-h-11 px-5 py-3", { variants: { variant: { default: "bg-primary text-white hover:bg-primary/90", outline: "border border-border bg-white hover:bg-muted", ghost: "hover:bg-muted", destructive: "bg-red-700 text-white hover:bg-red-800" } }, defaultVariants: { variant: "default" } });
function Button({ className, variant, asChild = false, ...props }: React.ComponentProps<"button"> & VariantProps<typeof buttonVariants> & { asChild?: boolean }) { const Comp = asChild ? Slot : "button"; return <Comp data-slot="button" className={cn(buttonVariants({ variant, className }))} {...props} />; }
export { Button, buttonVariants };
