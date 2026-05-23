'use client'

import { useEffect, useRef, useImperativeHandle, forwardRef } from 'react'
import { Terminal } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import { WebLinksAddon } from '@xterm/addon-web-links'
import '@xterm/xterm/css/xterm.css'

/**
 * xterm.js terminal wrapper for React.
 *
 * Exposed methods via ref:
 *   - write(data: string)   – write raw text/ANSI to the terminal
 *   - writeln(data: string) – write + newline
 *   - clear()               – clear the terminal buffer
 *   - focus()               – focus the terminal
 *   - getTerminal()         – access the raw Terminal instance
 *
 * Props:
 *   - onInput(cmd: string)  – fired when user presses Enter with a line
 *   - onKey(event)          – raw key event from xterm
 *   - welcomeMessage        – optional string shown on mount
 *   - options               – extra ITerminalOptions merged on top of defaults
 *   - className             – CSS class on the container div
 */
const XTerminal = forwardRef(function XTerminal(
  { onInput, onKey, welcomeMessage, options = {}, className = '', style = {} },
  ref
) {
  const containerRef = useRef(null)
  const termRef = useRef(null)
  const fitRef = useRef(null)
  const inputBuffer = useRef('')

  // ── Expose imperative handle ──
  useImperativeHandle(ref, () => ({
    write: (data) => termRef.current?.write(data),
    writeln: (data) => termRef.current?.writeln(data),
    clear: () => termRef.current?.clear(),
    focus: () => termRef.current?.focus(),
    getTerminal: () => termRef.current,
  }))

  // ── Initialize terminal ──
  useEffect(() => {
    if (!containerRef.current || termRef.current) return

    const term = new Terminal({
      theme: {
        background: '#0d0d0d',
        foreground: '#d4d4d4',
        cursor: '#00ff41',
        cursorAccent: '#0d0d0d',
        selectionBackground: 'rgba(255, 255, 255, 0.12)',
        black: '#0d0d0d',
        red: '#ff5f56',
        green: '#00ff41',
        yellow: '#ffbd2e',
        blue: '#6ea6ff',
        magenta: '#c792ea',
        cyan: '#56d4dd',
        white: '#d4d4d4',
        brightBlack: '#525252',
        brightRed: '#ff6b6b',
        brightGreen: '#69ff94',
        brightYellow: '#ffcb6b',
        brightBlue: '#82aaff',
        brightMagenta: '#c792ea',
        brightCyan: '#89ddff',
        brightWhite: '#e2e2e2',
      },
      fontFamily: "ui-monospace, SFMono-Regular, 'SF Mono', Menlo, Consolas, 'Liberation Mono', monospace",
      fontSize: 13,
      lineHeight: 1.5,
      cursorBlink: true,
      cursorStyle: 'bar',
      scrollback: 5000,
      allowProposedApi: true,
      convertEol: true,
      ...options,
    })

    const fitAddon = new FitAddon()
    const webLinksAddon = new WebLinksAddon()

    term.loadAddon(fitAddon)
    term.loadAddon(webLinksAddon)
    term.open(containerRef.current)

    // Initial fit + resize observer
    try { fitAddon.fit() } catch {}
    fitRef.current = fitAddon

    const resizeObserver = new ResizeObserver(() => {
      try { fitAddon.fit() } catch {}
    })
    resizeObserver.observe(containerRef.current)

    // ── Input handling ──
    term.onData((data) => {
      switch (data) {
        case '\r': // Enter
          term.write('\r\n')
          if (onInput && inputBuffer.current.trim()) {
            onInput(inputBuffer.current.trim())
          }
          inputBuffer.current = ''
          break
        case '\x7f': // Backspace
          if (inputBuffer.current.length > 0) {
            inputBuffer.current = inputBuffer.current.slice(0, -1)
            term.write('\b \b')
          }
          break
        case '\x03': // Ctrl+C
          term.write('^C\r\n')
          inputBuffer.current = ''
          break
        case '\x15': // Ctrl+U (clear line)
          if (inputBuffer.current.length > 0) {
            term.write(`\x1b[${inputBuffer.current.length}D\x1b[K`)
            inputBuffer.current = ''
          }
          break
        case '\x0c': // Ctrl+L (clear screen)
          term.clear()
          break
        default:
          // Only print printable characters (ignore raw escape sequences from arrow keys etc.)
          if (data >= ' ' || data === '\t') {
            inputBuffer.current += data
            term.write(data)
          }
          break
      }
    })

    term.onKey(({ domEvent }) => {
      if (onKey) onKey(domEvent)
    })

    termRef.current = term

    // ── Welcome message ──
    if (welcomeMessage) {
      term.writeln(welcomeMessage)
    }

    // Show prompt indicator
    term.write('\x1b[32m$\x1b[0m ')

    return () => {
      resizeObserver.disconnect()
      term.dispose()
      termRef.current = null
      fitRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div
      ref={containerRef}
      className={className}
      style={{ width: '100%', height: '100%', ...style }}
    />
  )
})

export default XTerminal
