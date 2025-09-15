import { cn } from "@/lib/utils";
import {
  LoaderCircleIcon,
  type LucideProps,
} from 'lucide-react';

type SpinnerProps = {
  variant?: "ring" | "circle-filled";
  size?: "sm" | "md" | "lg";
  className?: string;
  "aria-label"?: string;
};

const sizeMap = {
  sm: "size-4",
  md: "size-5",
  lg: "size-6",
} as const;

export function Spinner({ variant = "circle-filled", size = "md", className, ...rest }: SpinnerProps) {
  const s = sizeMap[size];

  if (variant === "ring") {
    return (
      <svg
        stroke="currentColor"
        viewBox="0 0 44 44"
        xmlns="http://www.w3.org/2000/svg"
        className={cn("animate-spin", s, className)}
        role="status"
        {...rest}
      >
        <title>Loading...</title>
        <g fill="none" fillRule="evenodd" strokeWidth="2">
          <circle cx="22" cy="22" r="1">
            <animate
              attributeName="r"
              begin="0s"
              calcMode="spline"
              dur="1.8s"
              keySplines="0.165, 0.84, 0.44, 1"
              keyTimes="0; 1"
              repeatCount="indefinite"
              values="1; 20"
            />
            <animate
              attributeName="stroke-opacity"
              begin="0s"
              calcMode="spline"
              dur="1.8s"
              keySplines="0.3, 0.61, 0.355, 1"
              keyTimes="0; 1"
              repeatCount="indefinite"
              values="1; 0"
            />
          </circle>
          <circle cx="22" cy="22" r="1">
            <animate
              attributeName="r"
              begin="-0.9s"
              calcMode="spline"
              dur="1.8s"
              keySplines="0.165, 0.84, 0.44, 1"
              keyTimes="0; 1"
              repeatCount="indefinite"
              values="1; 20"
            />
            <animate
              attributeName="stroke-opacity"
              begin="-0.9s"
              calcMode="spline"
              dur="1.8s"
              keySplines="0.3, 0.61, 0.355, 1"
              keyTimes="0; 1"
              repeatCount="indefinite"
              values="1; 0"
            />
          </circle>
        </g>
      </svg>
    )
  }

  return (
    <div className={cn("relative", s, className)}>
      <div className="absolute inset-0 rotate-180">
        <LoaderCircleIcon
          className={cn('animate-spin', 'text-foreground opacity-20')}
          size={size}
          {...rest}
        />
      </div>
      <LoaderCircleIcon
        className={cn('relative animate-spin')}
        size={size}
        {...rest}
      />
    </div>
  )
}

