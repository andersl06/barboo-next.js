import Link from "next/link"
import type { ButtonHTMLAttributes, ReactNode } from "react"

type UIButtonBaseProps = {
  variant?: "primary" | "secondary"
  className?: string
  children: ReactNode
}

type UIButtonLinkProps = UIButtonBaseProps & {
  href: string
}

type UIButtonButtonProps = UIButtonBaseProps
  & ButtonHTMLAttributes<HTMLButtonElement>
  & {
    href?: undefined
  }

type UIButtonProps = UIButtonLinkProps | UIButtonButtonProps

function isLinkProps(props: UIButtonProps): props is UIButtonLinkProps {
  return typeof (props as UIButtonLinkProps).href === "string"
}

export function UIButton(props: UIButtonProps) {
  const variant = props.variant ?? "primary"

  const base =
    "inline-flex items-center justify-center rounded-lg border px-5 py-2.5 text-base font-semibold transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-0 active:translate-y-[0px]"

  const variants = {
    primary:
      "border-[#ff965f]/30 bg-gradient-to-b from-[#f36c20] via-[#e0531e] to-[#cb4518] text-white shadow-[0_8px_20px_rgba(243,108,32,0.25),inset_0_1px_0_rgba(255,255,255,0.22)] hover:-translate-y-[1px] hover:brightness-110 hover:shadow-[0_10px_26px_rgba(243,108,32,0.34)] focus-visible:ring-[#f36c20]/65",
    secondary:
      "border-white/10 bg-gradient-to-b from-[#101538] via-[#0b0d27] to-[#080a1f] text-[#f1f2f7] shadow-[0_8px_18px_rgba(0,0,0,0.35),inset_0_1px_0_rgba(255,255,255,0.1)] hover:-translate-y-[1px] hover:from-[#152052] hover:to-[#0d1333] hover:shadow-[0_10px_24px_rgba(0,0,0,0.45)] focus-visible:ring-[#2967d8]/60",
  }

  const classes = `${base} ${variants[variant]} ${props.className ?? ""}`

  if (isLinkProps(props)) {
    const { href, children } = props

    return (
      <Link href={href} className={classes}>
        {children}
      </Link>
    )
  }

  const {
    type = "button",
    className: _className,
    variant: _variant,
    children,
    ...buttonProps
  } = props
  void _className
  void _variant

  return (
    <button
      type={type}
      className={classes}
      {...buttonProps}
    >
      {children}
    </button>
  )
}
