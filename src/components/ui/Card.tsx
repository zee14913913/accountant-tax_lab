import { cn } from '@/lib/utils'

interface CardProps {
  children: React.ReactNode
  className?: string
  size?: 'sm' | 'default'
}

export function Card({ children, className, size = 'default' }: CardProps) {
  return (
    <div className={cn(size === 'sm' ? 'card-sm' : 'card', className)}>
      {children}
    </div>
  )
}

export function CardHeader({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn('mb-4', className)}>{children}</div>
}

export function CardTitle({ children, className }: { children: React.ReactNode; className?: string }) {
  return <h3 className={cn('text-card-title text-ink-primary', className)}>{children}</h3>
}

export function CardContent({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn('text-body text-ink-secondary', className)}>{children}</div>
}
