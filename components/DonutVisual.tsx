import type { CSSProperties } from "react"

const colors = ["#69db7c", "#ffd43b", "#ff8787", "#74c0fc", "#b197fc", "#ff922b"]

const pseudoRandom = (seed: number) => {
  const x = Math.sin(seed) * 10000
  return x - Math.floor(x)
}

const sprinkles = Array.from({ length: 24 }).map((_, i) => {
  const l = 25 + pseudoRandom(i + 1) * 170
  const t = 25 + pseudoRandom((i + 1) * 2) * 170
  const r = `${pseudoRandom((i + 1) * 3) * 180 - 90}deg`
  const style = {
    "--c": colors[i % colors.length],
    "--l": `${l.toFixed(1)}px`,
    "--t": `${t.toFixed(1)}px`,
    "--r": r,
  } as CSSProperties
  return <span key={i} className="sprinkle" style={style} />
})

export function DonutVisual() {
  return <div className="donut mx-auto">{sprinkles}</div>
}
