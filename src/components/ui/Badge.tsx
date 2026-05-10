import { cn } from '@/lib/utils'

interface BadgeProps {
  variant?: 'success' | 'warning' | 'error' | 'info' | 'neutral'
  children: React.ReactNode
  className?: string
}

export function Badge({ variant = 'neutral', children, className }: BadgeProps) {
  const variants = {
    success: 'badge-success',
    warning: 'badge-warning',
    error:   'badge-error',
    info:    'badge-info',
    neutral: 'badge-neutral',
  }
  return (
    <span className={cn(variants[variant], className)}>
      {children}
    </span>
  )
}
