import clsx from 'clsx'
import { ReactNode } from 'react'

interface ButtonProps {
  children: ReactNode
  onClick?: () => void
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost'
  size?: 'sm' | 'md' | 'lg'
  disabled?: boolean
  className?: string
  type?: 'button' | 'submit'
}

export function Button({
  children,
  onClick,
  variant = 'primary',
  size = 'md',
  disabled = false,
  className = '',
  type = 'button',
}: ButtonProps) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={clsx(
        'rounded-lg font-medium transition-all duration-200 flex items-center gap-2 justify-center',
        {
          'bg-primary-600 hover:bg-primary-700 text-white shadow-lg shadow-primary-600/20':
            variant === 'primary',
          'bg-surface-100 hover:bg-surface-200 text-gray-200': variant === 'secondary',
          'bg-red-600/20 hover:bg-red-600/40 text-red-400': variant === 'danger',
          'hover:bg-surface-100 text-gray-400 hover:text-gray-200': variant === 'ghost',
          'px-3 py-1.5 text-sm': size === 'sm',
          'px-4 py-2 text-sm': size === 'md',
          'px-6 py-3 text-base': size === 'lg',
          'opacity-50 cursor-not-allowed': disabled,
        },
        className
      )}
    >
      {children}
    </button>
  )
}

// ============ Card ============
export function Card({
  children,
  className = '',
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <div className={clsx('bg-surface-300 border border-white/5 rounded-xl p-5', className)}>
      {children}
    </div>
  )
}

// ============ Input ============
export function Input({
  label,
  value,
  onChange,
  placeholder,
  type = 'text',
  className = '',
}: {
  label?: string
  value: string
  onChange: (v: string) => void
  placeholder?: string
  type?: string
  className?: string
}) {
  return (
    <div className={className}>
      {label && <label className="block text-sm text-gray-400 mb-1.5">{label}</label>}
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full bg-dark-900 border border-white/10 rounded-lg px-3 py-2 text-sm text-gray-100 placeholder-gray-600 focus:outline-none focus:border-primary-500 transition-colors"
      />
    </div>
  )
}

// ============ Textarea ============
export function Textarea({
  label,
  value,
  onChange,
  placeholder,
  rows = 4,
  className = '',
}: {
  label?: string
  value: string
  onChange: (v: string) => void
  placeholder?: string
  rows?: number
  className?: string
}) {
  return (
    <div className={className}>
      {label && <label className="block text-sm text-gray-400 mb-1.5">{label}</label>}
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        rows={rows}
        className="w-full bg-dark-900 border border-white/10 rounded-lg px-3 py-2 text-sm text-gray-100 placeholder-gray-600 focus:outline-none focus:border-primary-500 transition-colors resize-y font-mono"
      />
    </div>
  )
}

// ============ Select ============
export function Select({
  label,
  value,
  onChange,
  options,
  className = '',
}: {
  label?: string
  value: string
  onChange: (v: string) => void
  options: { value: string; label: string }[]
  className?: string
}) {
  return (
    <div className={className}>
      {label && <label className="block text-sm text-gray-400 mb-1.5">{label}</label>}
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full bg-dark-900 border border-white/10 rounded-lg px-3 py-2 text-sm text-gray-100 focus:outline-none focus:border-primary-500 transition-colors"
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  )
}

// ============ Badge ============
export function Badge({
  children,
  color = 'gray',
}: {
  children: ReactNode
  color?: 'green' | 'red' | 'yellow' | 'gray' | 'blue'
}) {
  const colors: Record<string, string> = {
    green: 'bg-green-500/20 text-green-400',
    red: 'bg-red-500/20 text-red-400',
    yellow: 'bg-yellow-500/20 text-yellow-400',
    gray: 'bg-gray-500/20 text-gray-400',
    blue: 'bg-blue-500/20 text-blue-400',
  }
  return (
    <span className={clsx('px-2 py-0.5 rounded-full text-xs font-medium', colors[color])}>
      {children}
    </span>
  )
}

// ============ Table ============
export function Table({
  headers,
  children,
}: {
  headers: string[]
  children: ReactNode
}) {
  return (
    <div className="overflow-x-auto rounded-lg border border-white/5">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-surface-100">
            {headers.map((h, i) => (
              <th key={i} className="px-4 py-3 text-left text-gray-400 font-medium">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-white/5">{children}</tbody>
      </table>
    </div>
  )
}
