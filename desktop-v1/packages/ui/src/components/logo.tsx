import { type ComponentProps } from "solid-js"

export const Mark = (props: { class?: string }) => {
  return (
    <svg
      data-component="logo-mark"
      classList={{ [props.class ?? ""]: !!props.class }}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path d="M12 1.5L22 7.25V16.75L12 22.5L2 16.75V7.25L12 1.5Z" fill="var(--surface-strong)" />
      <path d="M12 1.5L22 7.25V16.75L12 22.5L2 16.75V7.25L12 1.5Z" stroke="var(--icon-strong-base)" />
      <path d="M8 15.25H14.75L17 12L14.75 8.75H8L10.25 12L8 15.25Z" fill="var(--icon-strong-base)" />
      <path d="M5.75 12H10.25" stroke="var(--icon-weak-base)" stroke-width="1.5" stroke-linecap="square" />
    </svg>
  )
}

export const Splash = (props: Pick<ComponentProps<"svg">, "ref" | "class">) => {
  return (
    <svg
      ref={props.ref}
      data-component="logo-splash"
      classList={{ [props.class ?? ""]: !!props.class }}
      viewBox="0 0 96 112"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path d="M48 4L88 27V85L48 108L8 85V27L48 4Z" fill="var(--surface-strong)" />
      <path d="M48 4L88 27V85L48 108L8 85V27L48 4Z" stroke="var(--icon-strong-base)" stroke-width="4" />
      <path d="M30 70H59L70 56L59 42H30L41 56L30 70Z" fill="var(--icon-strong-base)" />
      <path d="M22 56H41" stroke="var(--icon-weak-base)" stroke-width="6" stroke-linecap="square" />
    </svg>
  )
}

export const Logo = (props: { class?: string }) => {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 272 48"
      fill="none"
      classList={{ [props.class ?? ""]: !!props.class }}
    >
      <Mark class="h-9 w-9" />
      <text
        x="48"
        y="33"
        fill="var(--icon-strong-base)"
        font-family="var(--font-family-mono)"
        font-size="29"
        font-weight="700"
        letter-spacing="0"
      >
        STEALTH
      </text>
      <path d="M48 41H254" stroke="var(--icon-weak-base)" stroke-width="2" stroke-linecap="square" opacity="0.85" />
    </svg>
  )
}
