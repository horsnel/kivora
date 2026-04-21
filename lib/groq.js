import Groq from 'groq-sdk'

export const groq = new Groq({ apiKey: process.env.GROQ_API_KEY })
export const MODEL = 'llama-3.3-70b-versatile'
export const MODEL_FAST = 'llama-3.1-8b-instant'
