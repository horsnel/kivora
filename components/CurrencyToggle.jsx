'use client'
import { useState, useEffect, createContext, useContext } from 'react'
import { IconGlobe, IconClose, IconCheck, IconChevronDown } from '@/components/Icons'

const CURRENCIES = [
  { code: 'USD', symbol: '$',   name: 'US Dollar' },
  { code: 'NGN', symbol: '₦',  name: 'Nigerian Naira' },
  { code: 'GHS', symbol: 'GH₵',name: 'Ghanaian Cedi' },
  { code: 'KES', symbol: 'KSh',name: 'Kenyan Shilling' },
  { code: 'ZAR', symbol: 'R',  name: 'South African Rand' },
  { code: 'GBP', symbol: '£',  name: 'British Pound' },
  { code: 'EUR', symbol: '€',  name: 'Euro' },
  { code: 'CAD', symbol: 'CA$',name: 'Canadian Dollar' },
  { code: 'AUD', symbol: 'A$', name: 'Australian Dollar' },
  { code: 'INR', symbol: '₹',  name: 'Indian Rupee' },
  { code: 'BRL', symbol: 'R$', name: 'Brazilian Real' },
]

export const CurrencyContext = createContext({
  currency: CURRENCIES[0],
  rates: {},
  convert: (usd) => usd,
  format: (usd) => `$${usd}`,
})

export function CurrencyProvider({ children }) {
  const [currency, setCurrency] = useState(CURRENCIES[0])
  const [rates, setRates] = useState({})
  const [open, setOpen] = useState(false)
  const [showBanner, setShowBanner] = useState(false)
  const [suggested, setSuggested] = useState(null)

  useEffect(() => {
    const saved = localStorage.getItem('kv_currency')
    if (saved) {
      const found = CURRENCIES.find(c => c.code === saved)
      if (found) setCurrency(found)
    }

    fetch('/api/rates').then(r => r.json()).then(d => setRates(d)).catch(() => {})

    if (!saved) {
      fetch('https://ipapi.co/json/')
        .then(r => r.json())
        .then(d => {
          const map = { NG:'NGN', GH:'GHS', KE:'KES', ZA:'ZAR', GB:'GBP', DE:'EUR', FR:'EUR', IN:'INR', CA:'CAD', AU:'AUD', BR:'BRL' }
          const code = map[d.country_code]
          if (code && code !== 'USD') {
            const found = CURRENCIES.find(c => c.code === code)
            if (found) { setSuggested(found); setShowBanner(true) }
          }
        }).catch(() => {})
    }
  }, [])

  function select(c) {
    setCurrency(c)
    localStorage.setItem('kv_currency', c.code)
    setOpen(false)
    setShowBanner(false)
  }

  function convert(usd) {
    if (currency.code === 'USD' || !rates[currency.code]) return usd
    return Math.round(usd * rates[currency.code])
  }

  function format(usd) {
    return `${currency.symbol}${convert(usd).toLocaleString()}`
  }

  return (
    <CurrencyContext.Provider value={{ currency, rates, convert, format }}>
      {/* Detection banner */}
      {showBanner && suggested && (
        <div className="fixed bottom-4 left-4 right-4 md:left-auto md:right-4 md:w-72 z-50 bg-[#141414] border border-[#262626] rounded-2xl p-4 shadow-2xl animate-scale-in">
          <div className="flex items-start justify-between gap-2 mb-3">
            <div className="flex items-center gap-2">
              <IconGlobe size={14} className="text-[#737373] shrink-0 mt-0.5" />
              <p className="text-sm text-[#d4d4d4] leading-snug">
                Show prices in <span className="text-white font-semibold">{suggested.code}</span>?
              </p>
            </div>
            <button onClick={() => setShowBanner(false)} className="text-[#404040] hover:text-white transition-colors shrink-0">
              <IconClose size={14} />
            </button>
          </div>
          <div className="flex gap-2">
            <button onClick={() => select(suggested)} className="flex-1 bg-red-600 hover:bg-red-700 text-white text-xs py-2 rounded-lg transition-colors font-semibold">
              Show in {suggested.code}
            </button>
            <button onClick={() => { setShowBanner(false); localStorage.setItem('kv_currency', 'USD') }} className="flex-1 bg-[#262626] hover:bg-[#2e2e2e] text-[#d4d4d4] text-xs py-2 rounded-lg transition-colors">
              Keep USD
            </button>
          </div>
        </div>
      )}

      {/* Currency toggle */}
      <div className="fixed top-[14px] right-[72px] md:right-[144px] z-50">
        <div className="relative">
          <button
            onClick={() => setOpen(!open)}
            className="flex items-center gap-1.5 bg-[#141414] border border-[#262626] hover:border-[#3a3a3a] px-2.5 py-1.5 rounded-lg text-xs text-[#737373] hover:text-white transition-all font-mono"
          >
            <span className="font-sans text-[11px] font-medium">{currency.symbol}</span>
            <span>{currency.code}</span>
            <IconChevronDown size={10} className={`transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
          </button>

          {open && (
            <div className="absolute right-0 top-full mt-1.5 w-44 bg-[#141414] border border-[#262626] rounded-xl overflow-hidden shadow-2xl animate-scale-in">
              <div className="py-1">
                {CURRENCIES.map(c => (
                  <button
                    key={c.code}
                    onClick={() => select(c)}
                    className={`w-full flex items-center justify-between px-3 py-2 text-xs hover:bg-[#1a1a1a] transition-colors ${
                      currency.code === c.code ? 'text-red-400' : 'text-[#737373] hover:text-white'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className="font-mono w-8">{c.code}</span>
                      <span className="text-[#404040]">{c.symbol}</span>
                    </div>
                    {currency.code === c.code && <IconCheck size={11} className="text-red-400" />}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {children}
    </CurrencyContext.Provider>
  )
}

export function useCurrency() {
  return useContext(CurrencyContext)
}
