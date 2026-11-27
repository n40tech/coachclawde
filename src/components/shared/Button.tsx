import { type ButtonHTMLAttributes, type MouseEvent, type ReactNode } from 'react'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger'
  size?: 'sm' | 'md' | 'lg'
  children: ReactNode
  fullWidth?: boolean
  /**
   * Busy with the action this button started. It stays focusable (so
   * keyboard focus isn't dropped mid-action, as `disabled` would) and
   * ignores presses until done.
   */
  loading?: boolean
}

const variants = {
  primary: 'bg-accent-fill hover:bg-accent-fill-hover text-white font-semibold shadow-lg shadow-ice/20 active:scale-95',
  secondary: 'bg-slush hover:bg-rime text-snow border border-rime active:scale-95',
  ghost: 'bg-transparent hover:bg-slush text-frost active:scale-95',
  danger: 'bg-[#ef4444]/10 hover:bg-[#ef4444]/20 text-[#ef4444] border border-[#ef4444]/20 active:scale-95',
}

const sizes = {
  sm: 'px-3 py-1.5 text-sm rounded-xl',
  md: 'px-5 py-3 text-base rounded-2xl',
  lg: 'px-6 py-4 text-lg rounded-2xl',
}

export function Button({ variant = 'primary', size = 'md', children, fullWidth, loading, className = '', disabled, onClick, ...props }: ButtonProps) {
  return (
    <button
      className={`
        inline-flex items-center justify-center gap-2 transition-all duration-150 select-none
        ${variants[variant]} ${sizes[size]}
        ${fullWidth ? 'w-full' : ''}
        ${disabled ? 'opacity-50 pointer-events-none' : loading ? 'opacity-50 cursor-progress' : ''}
        ${className}
      `}
      disabled={disabled}
      aria-disabled={loading || undefined}
      onClick={(e: MouseEvent<HTMLButtonElement>) => {
        if (loading) {
          e.preventDefault()
          return
        }
        onClick?.(e)
      }}
      {...props}
    >
      {loading && (
        <span aria-hidden className="w-4 h-4 border-2 border-current border-t-transparent rounded-full motion-safe:animate-spin" />
      )}
      {children}
    </button>
  )
}
