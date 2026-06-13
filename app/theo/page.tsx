import TheoDashboard from '@/components/TheoDashboard'

export const revalidate = 0

export default function TheoPage() {
  const autonomous = process.env.THEO_AUTONOMOUS === 'true'
  const model = process.env.THEO_MODEL ?? 'gemma4'
  return <TheoDashboard autonomous={autonomous} model={model} />
}
